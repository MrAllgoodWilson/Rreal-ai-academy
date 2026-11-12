import {describe,it,expect} from 'vitest';
import {sandboxStorageSafe,resolveCheckoutPrice} from '../src/lib/stripe-sandbox-guard';
import {isolatedStorage} from './isolated-storage-fixture';
describe('isolated sandbox storage boundary',()=>{
 it('requires distinct allowlisted project and matching dedicated browser/admin credentials',()=>{
  expect(sandboxStorageSafe(isolatedStorage)).toBe(true);
  for(const field of Object.keys(isolatedStorage)){
   expect(sandboxStorageSafe({...isolatedStorage,[field]:''}),field).toBe(false);
  }
  for(const change of [
   {SUPABASE_PRODUCTION_PROJECT_REF:isolatedStorage.SUPABASE_TEST_PROJECT_REF},
   {NEXT_PUBLIC_SUPABASE_URL:'https://pppppppppppppppppppp.supabase.co'},
   {NEXT_PUBLIC_SUPABASE_URL:isolatedStorage.NEXT_PUBLIC_SUPABASE_URL+'/'},
   {SUPABASE_SERVICE_ROLE_KEY:'wrong'}, {NEXT_PUBLIC_SUPABASE_ANON_KEY:'wrong'}
  ])expect(sandboxStorageSafe({...isolatedStorage,...change})).toBe(false);
 });
 it('accepts restricted test key only with full isolated configuration',()=>{
  const e={...isolatedStorage,STRIPE_CHECKOUT_MODE:'test',STRIPE_SECRET_KEY:'rk_test_fixture',STRIPE_TEST_PRICE_MONTHLY:'price_fixture'};
  expect(resolveCheckoutPrice(e)?.sandbox).toBe(true);
  expect(resolveCheckoutPrice({...e,SUPABASE_TEST_PROJECT_REF:''})).toBe(null);
 });
});
