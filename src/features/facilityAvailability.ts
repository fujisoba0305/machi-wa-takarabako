/** Absence of these signals means unknown, never verified open. */
export function hasInactiveFacilitySignal(tags: Record<string, string | undefined> = {}): boolean {
 const lifecycle = /^(?:disused|abandoned|demolished|removed|razed|destroyed|closed)(?::(?:amenity|shop|tourism|leisure))?$/;
 for (const [key, value] of Object.entries(tags)) {
  if (lifecycle.test(key) && value && !['no','false','0'].includes(value.trim().toLowerCase())) {
   const current=key.includes(':')?tags[key.split(':')[1]]:undefined;
   // A different active use can describe a replacement business, not a closed current shop.
   if (!current || current===value || ['yes','true','1'].includes(value.trim().toLowerCase())) return true;
  }
  if (['amenity','shop','tourism','leisure'].includes(key) && /^(?:vacant|disused|abandoned|demolished|closed|no)$/i.test(value?.trim() ?? '')) return true;
 }
 const name=tags.name?.normalize('NFKC') ?? '';
 return /[([【]\s*(?:閉業|閉店|廃業|営業終了|移転済み|closed|permanently closed)\s*[)\]】]/i.test(name) || /(?:^|\s)(?:閉業|廃業|permanently closed)\s*$/i.test(name);
}
