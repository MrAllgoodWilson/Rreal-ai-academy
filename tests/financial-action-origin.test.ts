import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({member:vi.fn()}));
vi.mock("@/lib/server-auth",()=>({getMember:m.member}));
import { POST as referral } from "@/app/api/referrals/route";
import { POST as quote } from "@/app/api/project-wallet/quote/route";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("NEXT_PUBLIC_SITE_URL","https://rrealaiacademy.app");vi.stubEnv("REFERRALS_ENABLED","true");});
afterEach(()=>vi.unstubAllEnvs());
describe("feature/referral mutations require explicit same-origin intent",()=>{
 it.each([referral,quote])("rejects a foreign-origin request before any member mutation",async handler=>{
  const res=await handler(new Request("https://rrealaiacademy.app/api/action",{method:"POST",headers:{origin:"https://foreign.example","content-type":"application/json"},body:'{}'}));
  expect(res.status).toBe(403);expect(m.member).not.toHaveBeenCalled();
 });
 it.each([referral,quote])("rejects missing origins rather than treating a cookie as consent",async handler=>{
  const res=await handler(new Request("https://rrealaiacademy.app/api/action",{method:"POST",body:'{}'}));
  expect(res.status).toBe(403);expect(m.member).not.toHaveBeenCalled();
 });
});
