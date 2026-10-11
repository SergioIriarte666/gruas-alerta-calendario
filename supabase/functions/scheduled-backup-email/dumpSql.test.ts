import { dumpSql } from './dumpSql.ts';
const assert = (value: unknown) => { if (!value) throw new Error('Assertion failed'); };
Deno.test('comprime bloques de una tabla y suma filas sin duplicar cobertura', async () => {
  const chunks = [
    { body: '-- ===== large =====\nINSERT 1;\n', next_table: 'large', next_offset: 1, rows_by_table: {large: 1} },
    { body: 'INSERT 2;\n-- 2 filas\n', next_table: null, next_offset: 0, rows_by_table: {large: 1, empty: 0} },
  ];
  const stats: {table:string;rows:number}[]=[];
  let call=0;
  const blob=await dumpSql({rpc: async (name: string, args: Record<string,unknown>) => {
    assert(name==='backup_dump_chunk_v2');
    assert(args.p_start_offset===call);
    return {data:[chunks[call++]],error:null};
  }},stats);
  const sql=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  assert(sql.includes('INSERT 1;\nINSERT 2;\n-- 2 filas'));
  assert(stats.length===2 && stats[0].rows===2 && stats[1].rows===0);
});
Deno.test('rechaza cursores estancados sin entregar un archivo parcial', async () => {
  const stats: {table:string;rows:number}[]=[];
  let rejected=false;
  try {
    await dumpSql({rpc:async()=>({data:[{body:'abc',next_table:'large',next_offset:1,rows_by_table:{large:1}}],error:null})},stats);
  } catch {rejected=true;}
  assert(rejected && stats.length===0);
});
Deno.test('un error RPC aborta la compresión y no declara cobertura completa', async () => {
  const stats: {table:string;rows:number}[]=[];
  let rejected=false;
  try { await dumpSql({rpc:async()=>({data:null,error:{message:'timeout'}})},stats); }
  catch {rejected=true;}
  assert(rejected && stats.length===0);
});
