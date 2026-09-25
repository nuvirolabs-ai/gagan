/** Revocation is synchronous; a retained callback cannot replay as a later login. */
export function createAccountBoundary() {
  let accountId:string|null=null;
  let generation=0;
  return {
    set(next:string|null) { if(next!==accountId) { accountId=next; generation++; } },
    bind(expected:string) {
      const captured=generation;
      return () => accountId===expected && generation===captured;
    },
  };
}
