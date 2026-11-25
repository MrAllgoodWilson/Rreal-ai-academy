import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn(), deleteUser: vi.fn(), signOut: vi.fn(), sub: vi.fn(), published: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ getMember: async () => ({ demo:false, member:{ user:{id:"fixture-user"}, sb:{ from:()=>({select:()=>({eq:()=>({in:()=>({limit:()=>({maybeSingle:m.sub})})})})}), auth:{signOut:m.signOut} } } }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin:()=>({rpc:m.rpc,from:()=>({select:()=>({eq:()=>({eq:m.published})})}),auth:{admin:{deleteUser:m.deleteUser}}}) }));
vi.mock("@/lib/rate-limit", () => ({ clientIp:()=>"fixture",rateLimit:()=>({ok:true}) }));
import { POST } from "@/app/api/account/delete/route";
const call=()=>POST(new Request("https://fixture.test",{method:"POST",body:JSON.stringify({confirm:"DELETE"}),headers:{"content-type":"application/json"}}));
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("PROJECT_WALLET_ENABLED","true");m.sub.mockResolvedValue({data:null,error:null});m.published.mockResolvedValue({data:[],error:null});m.rpc.mockResolvedValue({data:{blocked:false},error:null});m.deleteUser.mockResolvedValue({error:null});m.signOut.mockResolvedValue({});});
afterEach(()=>vi.unstubAllEnvs());
describe("account closure protects purchased feature access",()=>{
 it("refuses deletion on unresolved feature history",async()=>{m.rpc.mockResolvedValue({data:{blocked:true},error:null});expect((await call()).status).toBe(409);expect(m.deleteUser).not.toHaveBeenCalled();});
 it("fails closed if the financial closure lookup is unavailable",async()=>{m.rpc.mockResolvedValue({data:null,error:{message:"fixture failure"}});expect((await call()).status).toBe(503);expect(m.deleteUser).not.toHaveBeenCalled();});
 it("does not query a wallet migration when that feature is disabled",async()=>{vi.stubEnv("PROJECT_WALLET_ENABLED","false");expect((await call()).status).toBe(200);expect(m.rpc).not.toHaveBeenCalled();expect(m.deleteUser).toHaveBeenCalledOnce();});
 it("permits deletion only after all closure checks confirm no unresolved financial history",async()=>{expect((await call()).status).toBe(200);expect(m.rpc).toHaveBeenCalledWith("project_wallet_account_closure_status",{p_user:"fixture-user"});expect(m.deleteUser).toHaveBeenCalledWith("fixture-user");});
});
