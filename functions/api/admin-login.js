import { XPH_RESOURCE_CONTRACT } from '../../shared/resource-contract.js';
import { verifyPassword, createSession, sessionCookie, sameOrigin, json } from '../lib/admin-auth.js';
export async function onRequestOptions({request}){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':sameOrigin(request)?(request.headers.get('Origin')||'https://xph.asia'):'https://xph.asia','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}})}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({ok:false,error:{code:XPH_RESOURCE_CONTRACT.errors.UNAUTHORIZED,message:'请求来源无效'}},403);
 let body;try{body=await request.json()}catch{return json({ok:false,error:{code:XPH_RESOURCE_CONTRACT.errors.INVALID_REQUEST,message:'请求 JSON 无效'}},400)}
 const password=String(body?.password??'');
 if(!password||password.length>256)return json({ok:false,error:{code:XPH_RESOURCE_CONTRACT.errors.INVALID_REQUEST,message:'密码格式无效'}},400);
 if(!(await verifyPassword(password,env)))return json({ok:false,error:{code:XPH_RESOURCE_CONTRACT.errors.UNAUTHORIZED,message:'密码错误'}},401);
 try{const token=await createSession(env);return json({ok:true,status:'completed',stage:'completed',data:{contractVersion:XPH_RESOURCE_CONTRACT.version},error:null},200,{'Set-Cookie':sessionCookie(token),'Access-Control-Allow-Origin':request.headers.get('Origin')||'https://xph.asia','Vary':'Origin'});}catch(e){return json({ok:false,error:{code:XPH_RESOURCE_CONTRACT.errors.INTERNAL_ERROR,message:e.message}},500)}
}