import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePagedCosts } from '../useCosts';
const mocks=vi.hoisted(()=>({ options: null as null | {queryFn:()=>Promise<unknown>}, rpc:vi.fn(), from:vi.fn() }));
vi.mock('@tanstack/react-query',()=>({ useQuery:(options: typeof mocks.options)=>{mocks.options=options;return {};},useMutation:vi.fn(),useQueryClient:vi.fn(),keepPreviousData:vi.fn() }));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mocks.rpc,from:mocks.from}}));
vi.mock('@/hooks/useErrorHandler',()=>({useErrorHandler:vi.fn()}));
vi.mock('../useUniversalSync',()=>({useUniversalSync:vi.fn()}));

function setup(batches: { data: unknown[] | null; count: number | null; error: {message:string} | null }[]) {
 const query={select:vi.fn(),order:vi.fn(),range:vi.fn(),gte:vi.fn(),lte:vi.fn(),eq:vi.fn(),then:(resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown)=>Promise.resolve(batches.shift()).then(resolve,reject)};
 for(const method of ['select','order','range','gte','lte','eq'] as const) query[method].mockReturnValue(query);
 mocks.rpc.mockReturnValue(query);mocks.from.mockReturnValue(query);
 return query;
}
beforeEach(()=>vi.clearAllMocks());
describe('búsqueda paginada de costos',()=>{
 it('consulta el RPC y obtiene todos los resultados con filtros de fecha y entidad',async()=>{
  const first=Array.from({length:1000},(_,i)=>({id:String(i)}));
  const query=setup([{data:first,count:1001,error:null},{data:[{id:'last'}],count:1001,error:null}]);
  usePagedCosts(3,20,{searchTerm:' cadenas ',dateFrom:'2026-10-01',dateTo:'2026-10-11',entity:'gruas_5_norte'});
  const result=await mocks.options!.queryFn() as {costs:unknown[];total:number};
  expect(result.costs).toHaveLength(1001);expect(result.total).toBe(1001);
  expect(mocks.rpc).toHaveBeenCalledWith('search_costs',{p_search:'cadenas'});
  expect(mocks.from).not.toHaveBeenCalled();
  expect(query.range.mock.calls).toEqual([[0,999],[1000,1999]]);
  expect(query.gte).toHaveBeenCalledWith('date','2026-10-01');
  expect(query.lte).toHaveBeenCalledWith('date','2026-10-11');
  expect(query.eq).toHaveBeenCalledWith('entity','gruas_5_norte');
 });
 it('sin búsqueda conserva la paginación del servidor',async()=>{
  const query=setup([{data:[{id:'1'}],count:200,error:null}]);
  usePagedCosts(3,20);
  expect(await mocks.options!.queryFn()).toEqual({costs:[{id:'1'}],total:200});
  expect(mocks.from).toHaveBeenCalledWith('costs');expect(mocks.rpc).not.toHaveBeenCalled();
  expect(query.range).toHaveBeenCalledWith(40,59);
 });
 it('reporta errores sin presentar un conjunto truncado como completo',async()=>{
  setup([{data:null,count:null,error:{message:'Sin permiso'}}]);
  usePagedCosts(1,20,{searchTerm:'cadenas'});
  await expect(mocks.options!.queryFn()).rejects.toThrow('Sin permiso');
 });
});
