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

export async function refreshSupabaseSession(getUser:()=>Promise<AuthResult>,clearInvalidSession:()=>void){
 try{const{error}=await getUser();if(isMissingRefreshTokenError(error))clearInvalidSession()}
 catch(error){if(isMissingRefreshTokenError(error))clearInvalidSession()}
}
