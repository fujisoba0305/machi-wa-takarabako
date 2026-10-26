-- PROPOSAL ONLY. Never run against production without explicit approval.
-- Existing treasures, photos, EXP, discoveries and auth records are not rewritten.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.treasures'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'RLS must already be enabled'; END IF;
 IF pg_has_role('authenticated','anon','MEMBER') OR pg_has_role('anon','authenticated','MEMBER') OR pg_has_role('authenticated','service_role','MEMBER') THEN RAISE EXCEPTION 'Unexpected role inheritance; audit before applying'; END IF;
 IF to_regprocedure('public.create_my_treasure(jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'Another create RPC exists. Audit separately before applying'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd IN ('INSERT','DELETE','ALL') AND ('authenticated'=ANY(roles) OR 'public'=ANY(roles))) THEN RAISE EXCEPTION 'Storage policies differ; review before applying'; END IF;
END $$;
CREATE TABLE public.onsite_post_requests(
 uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL,
 treasure_id bigint NULL REFERENCES public.treasures(id) ON DELETE RESTRICT,
 PRIMARY KEY(uid,request_id)
);
CREATE TABLE public.onsite_post_photos(treasure_id bigint NOT NULL REFERENCES public.treasures(id) ON DELETE RESTRICT,object_id uuid NOT NULL REFERENCES storage.objects(id) ON DELETE RESTRICT,PRIMARY KEY(treasure_id,object_id));
ALTER TABLE public.onsite_post_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onsite_post_photos FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.onsite_post_photos TO service_role;
ALTER TABLE public.onsite_post_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onsite_post_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.onsite_post_requests TO service_role;

-- No exact GPS fix/accuracy/timestamp is persisted. The existing treasure point is the public destination.
CREATE FUNCTION public.onsite_post_valid(p_value jsonb,p_fix jsonb) RETURNS boolean
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog AS $$
DECLARE a double precision;b double precision;c double precision;d double precision;distance_m double precision;stamp double precision;checked_ms double precision;
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' OR jsonb_typeof(p_fix) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF jsonb_typeof(p_value->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(p_value->'comment') IS DISTINCT FROM 'string' OR jsonb_typeof(p_value->'category') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 IF p_value->>'category' NOT IN ('🌿 自然・絶景','🍜 グルメ','🏯 歴史・文化','♨️ 温泉・癒やし','🎡 遊び・エンタメ','🛍️ 買い物・発見','🏃 運動・リフレッシュ','🎨 アート・学び','🔎 街の珍スポット','💎 その他の宝物','☕ カフェ','⛩️ 神社・お寺','🌳 自然','📷 写真スポット','🏪 お店','💎 その他') THEN RETURN false; END IF;
 IF length(btrim(p_value->>'name')) NOT BETWEEN 1 AND 60 OR length(p_value->>'comment')>160 OR p_value->>'category' IS NULL THEN RETURN false; END IF;
 IF jsonb_typeof(p_fix->'accuracy') IS DISTINCT FROM 'number' OR (p_fix->>'accuracy')::numeric NOT BETWEEN 0 AND 50 THEN RETURN false; END IF;
 stamp=(p_fix->>'timestamp')::double precision;
 a=(p_value->>'latitude')::double precision;b=(p_value->>'longitude')::double precision;c=(p_fix->>'latitude')::double precision;d=(p_fix->>'longitude')::double precision;
 IF a IS NULL OR b IS NULL OR c IS NULL OR d IS NULL OR NOT(a BETWEEN -90 AND 90 AND c BETWEEN -90 AND 90 AND b BETWEEN -180 AND 180 AND d BETWEEN -180 AND 180) THEN RETURN false; END IF;
 distance_m=6371000*2*asin(sqrt(least(1.0,power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2))));
 -- A single wall-clock sample, taken after validation work, never the SQL/transaction start.
 checked_ms=extract(epoch FROM clock_timestamp())*1000;
 RETURN stamp IS NOT NULL AND stamp BETWEEN checked_ms-30000 AND checked_ms+5000 AND distance_m<=100;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.onsite_post_valid(jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.onsite_post_images(p_uid uuid,p_value jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u text;
BEGIN
 IF p_value->>'additional_image_url' IS NOT NULL AND p_value->>'image_url' IS NULL THEN RETURN false; END IF;
 FOREACH u IN ARRAY ARRAY[p_value->>'image_url',p_value->>'additional_image_url'] LOOP
  IF u IS NULL THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='treasure-images' AND o.owner_id=p_uid::text
   AND split_part(o.name,'/',1)=p_uid::text
   AND u='https://jlzlnzyoyvxwgfnfigwa.supabase.co/storage/v1/object/public/treasure-images/'||o.name) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.onsite_post_images(uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.onsite_post_prepare(p_uid uuid,p_request uuid,p_hash text,p_token text,p_value jsonb,p_fix jsonb,p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE existing public.onsite_post_requests;
BEGIN
 IF p_uid IS NULL OR p_mode IS NULL OR p_mode NOT IN ('daily','adventure') OR public.onsite_post_valid(p_value,p_fix) IS NOT TRUE OR public.onsite_post_images(p_uid,p_value) IS NOT TRUE THEN RAISE EXCEPTION 'POST_INVALID'; END IF;
 INSERT INTO public.onsite_post_requests(uid,request_id,payload_hash,token_hash,expires_at) VALUES(p_uid,p_request,p_hash,p_token,clock_timestamp()+interval '60 seconds') ON CONFLICT DO NOTHING;
 SELECT * INTO existing FROM public.onsite_post_requests WHERE uid=p_uid AND request_id=p_request FOR UPDATE;
 IF existing.payload_hash<>p_hash THEN RAISE EXCEPTION 'POST_CONFLICT'; END IF;
 IF existing.treasure_id IS NOT NULL THEN RETURN jsonb_build_object('id',existing.treasure_id); END IF;
 -- ON CONFLICT / FOR UPDATE may have waited. Do not issue a proof for an aged fix.
 IF public.onsite_post_valid(p_value,p_fix) IS NOT TRUE THEN RAISE EXCEPTION 'POST_EXPIRED'; END IF;
 UPDATE public.onsite_post_requests SET token_hash=p_token,expires_at=clock_timestamp()+interval '60 seconds' WHERE uid=p_uid AND request_id=p_request;
 RETURN '{}'::jsonb;
END $$;
CREATE FUNCTION public.onsite_post_commit(p_uid uuid,p_request uuid,p_hash text,p_token text,p_value jsonb,p_fix jsonb,p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE existing public.onsite_post_requests;new_id bigint;
BEGIN
 IF p_uid IS NULL OR p_mode IS NULL OR p_mode NOT IN ('daily','adventure') OR public.onsite_post_valid(p_value,p_fix) IS NOT TRUE OR public.onsite_post_images(p_uid,p_value) IS NOT TRUE THEN RAISE EXCEPTION 'POST_INVALID'; END IF;
 SELECT * INTO existing FROM public.onsite_post_requests WHERE uid=p_uid AND request_id=p_request FOR UPDATE;
 IF NOT FOUND OR existing.payload_hash<>p_hash OR existing.token_hash<>p_token THEN RAISE EXCEPTION 'POST_CONFLICT'; END IF;
 IF existing.treasure_id IS NOT NULL THEN RETURN jsonb_build_object('id',existing.treasure_id); END IF;
 -- Recheck after the request-row lock, immediately before the treasure write.
 IF public.onsite_post_valid(p_value,p_fix) IS NOT TRUE OR existing.expires_at<clock_timestamp() THEN RAISE EXCEPTION 'POST_EXPIRED'; END IF;
 INSERT INTO public.treasures(name,comment,category,latitude,longitude,image_url,additional_image_url) VALUES(btrim(p_value->>'name'),p_value->>'comment',p_value->>'category',(p_value->>'latitude')::double precision,(p_value->>'longitude')::double precision,p_value->>'image_url',p_value->>'additional_image_url') RETURNING id INTO new_id;
 INSERT INTO public.onsite_post_photos(treasure_id,object_id) SELECT new_id,o.id FROM storage.objects o WHERE o.bucket_id='treasure-images' AND (p_value->>'image_url'='https://jlzlnzyoyvxwgfnfigwa.supabase.co/storage/v1/object/public/treasure-images/'||o.name OR p_value->>'additional_image_url'='https://jlzlnzyoyvxwgfnfigwa.supabase.co/storage/v1/object/public/treasure-images/'||o.name);
 UPDATE public.onsite_post_requests SET treasure_id=new_id WHERE uid=p_uid AND request_id=p_request;
 -- INSERT/FK checks or triggers may also wait. Roll back ALL writes if time expired.
 IF public.onsite_post_valid(p_value,p_fix) IS NOT TRUE OR existing.expires_at<clock_timestamp() THEN RAISE EXCEPTION 'POST_EXPIRED'; END IF;
 RETURN jsonb_build_object('id',new_id);
END $$;
REVOKE ALL ON FUNCTION public.onsite_post_prepare(uuid,uuid,text,text,jsonb,jsonb,text),public.onsite_post_commit(uuid,uuid,text,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.onsite_post_prepare(uuid,uuid,text,text,jsonb,jsonb,text),public.onsite_post_commit(uuid,uuid,text,text,jsonb,jsonb,text) TO service_role;
-- Prevent bypass via PostgREST. Existing SELECT policies and permissions are untouched.
REVOKE INSERT ON public.treasures FROM anon,authenticated;
DO $$ BEGIN
 IF has_table_privilege('anon','public.treasures','INSERT') OR has_table_privilege('authenticated','public.treasures','INSERT') THEN RAISE EXCEPTION 'Inherited INSERT still exists; stop and audit'; END IF;
END $$;

-- New uploads only. No ownership changes to old files; public image reads remain unchanged.
CREATE POLICY "Onsite read own photos" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='treasure-images' AND split_part(name,'/',1)=(SELECT auth.uid())::text AND owner_id=(SELECT auth.uid())::text);
CREATE POLICY "Onsite own photo upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='treasure-images' AND split_part(name,'/',1)=(SELECT auth.uid())::text AND owner_id=(SELECT auth.uid())::text);
CREATE FUNCTION public.onsite_photo_unreferenced(p_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.treasures WHERE image_url='https://jlzlnzyoyvxwgfnfigwa.supabase.co/storage/v1/object/public/treasure-images/'||p_name OR additional_image_url='https://jlzlnzyoyvxwgfnfigwa.supabase.co/storage/v1/object/public/treasure-images/'||p_name);
$$;
REVOKE ALL ON FUNCTION public.onsite_photo_unreferenced(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.onsite_photo_unreferenced(text) TO authenticated;
CREATE POLICY "Onsite cleanup own unreferenced photo" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='treasure-images' AND split_part(name,'/',1)=(SELECT auth.uid())::text AND owner_id=(SELECT auth.uid())::text AND public.onsite_photo_unreferenced(name));
COMMIT;
