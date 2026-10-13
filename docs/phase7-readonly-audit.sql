-- READ ONLY: run in Supabase SQL Editor. No user rows, credentials or object names are selected.
select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage') and c.relkind in ('r','p') order by 1,2;
select table_schema,table_name,column_name,data_type,is_nullable
from information_schema.columns where table_schema='public' order by table_name,ordinal_position;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select n.nspname,c.relname,r.role_name,p.privilege,
 has_table_privilege(r.role_name,c.oid,p.privilege) as allowed
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)
where n.nspname in ('public','storage') and c.relkind in ('r','p') order by 1,2,3,4;
select table_schema,table_name,column_name,grantee,privilege_type
from information_schema.column_privileges where table_schema in ('public','storage') order by 1,2,3;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 p.prosecdef as security_definer,p.proconfig,r.role_name,
 has_function_privilege(r.role_name,p.oid,'EXECUTE') as can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join (values ('anon'),('authenticated')) r(role_name)
where n.nspname='public' order by 2,3,6;
select n.nspname,r.role_name,has_schema_privilege(r.role_name,n.oid,'USAGE') as usage,
 has_schema_privilege(r.role_name,n.oid,'CREATE') as create_allowed
from pg_namespace n cross join (values ('anon'),('authenticated')) r(role_name)
where n.nspname in ('public','storage');
select pg_get_userbyid(defaclrole) as owner,defaclnamespace::regnamespace as schema_name,
 defaclobjtype,defaclacl from pg_default_acl;
select id,public,file_size_limit,allowed_mime_types from storage.buckets;
-- Review public RPC source separately in Dashboard (especially SECURITY DEFINER).
-- Auth provider, Site URL, Redirect URLs and Data API exposed schemas are Dashboard settings.
