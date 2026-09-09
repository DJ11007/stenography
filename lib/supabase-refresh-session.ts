type AuthResult={error?:unknown};
type Cookie={name:string};
type RequestCookies={getAll():Cookie[];delete(name:string):unknown};
type ResponseCookies={set(cookie:{name:string;value:string;path:string;maxAge:number}):unknown};

export function isMissingRefreshTokenError(error:unknown){
 if(!error||typeof error!=="object")return false;
 const value=error as{code?:unknown;message?:unknown};
 if(value.code==="refresh_token_not_found")return true;
 return typeof value.message==="string"&&/invalid refresh token:\s*refresh token not found/iu.test(value.message)
}

export function isSupabaseAuthTokenCookie(name:string){return/^sb-[a-z0-9_-]+-auth-token(?:\.\d+)?$/iu.test(name)}

export function expireSupabaseAuthTokenCookies(requestCookies:RequestCookies,responseCookies:ResponseCookies){
 const names=[...new Set(requestCookies.getAll().map(cookie=>cookie.name).filter(isSupabaseAuthTokenCookie))];
 for(const name of names){requestCookies.delete(name);responseCookies.set({name,value:"",path:"/",maxAge:0})}
}

// Speed fix, reported live (deployed site): this runs on EVERY request
// proxy.ts covers -- effectively every page on the site -- and had no
// timeout at all. When Supabase's auth endpoint had a slow moment
// (measured live: 86s and 49s for plain page loads that don't even touch
// login, all of it inside this one getUser() call), the entire page
// waited right along with it -- there's no way for a hanging network
// call inside Next.js middleware to time out on its own. A student
// couldn't tell this apart from the site being down. Racing it against a
// timeout bounds the worst case to `timeoutMs` regardless of how slow
// Supabase gets: on timeout, this proceeds as if getUser() found no
// error -- i.e. it skips the refresh-token-repair path this request, the
// same outcome as any other request where the session is simply fine --
// rather than guessing wrong and either blocking or wrongly clearing a
// student's real session. The abandoned call is left to settle in the
// background and its result (including any error) is simply discarded;
// the .catch keeps a late rejection from surfacing as an unhandled
// promise rejection after this function has already returned.
export async function refreshSupabaseSession(getUser:()=>Promise<AuthResult>,clearInvalidSession:()=>void,timeoutMs=5000){
 try{
  const timeout=new Promise<AuthResult>(resolve=>{setTimeout(()=>resolve({error:undefined}),timeoutMs)});
  const{error}=await Promise.race([getUser().catch((error:unknown)=>({error})),timeout]);
  if(isMissingRefreshTokenError(error))clearInvalidSession();
 }
 catch(error){if(isMissingRefreshTokenError(error))clearInvalidSession()}
}
