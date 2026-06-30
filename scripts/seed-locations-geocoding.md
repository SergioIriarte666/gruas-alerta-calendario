# Seed inicial de coordenadas

1. Abrir `https://app.gruas5norte.cl` autenticado como admin.
2. Abrir DevTools -> `Console`.
3. Pegar el siguiente snippet y ejecutar:

```javascript
(async () => {
  const { data: { session } } = await window.supabase.auth.getSession();
  const token = session.access_token;

  const { data: locations } = await window.supabase
    .from('saved_locations')
    .select('id, name, address')
    .is('latitude', null)
    .eq('is_active', true);

  console.log(`Procesando ${locations.length} lugares...`);

  const ok = [];
  const failed = [];

  for (const loc of locations) {
    try {
      const res = await fetch(
        'https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/maps-proxy',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'geocode',
            query: loc.address ?? loc.name,
          }),
        },
      );
      const data = await res.json();

      if (!res.ok || !data.results?.[0]) {
        failed.push({ name: loc.name, reason: data.error ?? 'no_results' });
        continue;
      }

      const [lng, lat] = data.results[0].coordinates;
      const { error } = await window.supabase
        .from('saved_locations')
        .update({ latitude: lat, longitude: lng })
        .eq('id', loc.id);

      if (error) {
        failed.push({ name: loc.name, reason: error.message });
      } else {
        ok.push(loc.name);
        console.log(`OK ${loc.name} -> ${lat}, ${lng}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (err) {
      failed.push({ name: loc.name, reason: String(err) });
    }
  }

  console.log('-------------------------------');
  console.log(`OK: ${ok.length}`);
  console.log(`Fallidos: ${failed.length}`);
  if (failed.length > 0) console.table(failed);
})();
```

Si `window.supabase` no estuviera expuesto, habrá que exponerlo temporalmente antes de correr este seed.

4. Revisar el output. Lugares que aparezcan en `Fallidos` requieren ajustar manualmente su campo `address` y reintentar.
5. Verificar resultado:

```sql
SELECT count(*)
FROM public.saved_locations
WHERE latitude IS NULL
  AND is_active = true;
```

Debe devolver `0`.
