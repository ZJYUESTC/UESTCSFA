export const contentRoot='https://raw.githubusercontent.com/ZJYUESTC/UESTCSFA/main/'
export function validateGames(value){
  if(!Array.isArray(value))throw Error('Invalid games')
  return value.slice(0,100).filter(x=>x&&x.published!==false).map(x=>{
    if(typeof x.id!=='string'||typeof x.title!=='string'||typeof x.description!=='string')throw Error('Invalid game')
    if(x.kind==='quiz')return {id:x.id,title:x.title,description:x.description,kind:'quiz'}
    const url=new URL(x.url)
    if(x.kind!=='link'||url.protocol!=='https:')throw Error('Invalid game URL')
    return {id:x.id,title:x.title,description:x.description,kind:'link',url:url.href}
  })
}
const validate=(kind,value)=>kind==='games'?validateGames(value):validateContent(value)
export function validateContent(value){
  if(!Array.isArray(value))throw Error('Invalid content')
  return value.slice(0,100).map(x=>{
    if(!x||typeof x.id!=='string'||typeof x.title!=='string'||typeof x.body!=='string')throw Error('Invalid article')
    let image=''
    if(typeof x.image==='string'&&/^media\/[\w./-]+$/.test(x.image)&&!x.image.includes('..'))image=contentRoot+x.image
    return {id:x.id,title:x.title,body:x.body,publishedAt:typeof x.publishedAt==='string'?x.publishedAt:'',image,imageAlt:typeof x.imageAlt==='string'?x.imageAlt:'活动配图'}
  }).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))
}
export function readCache(kind,fallback){try{const raw=localStorage.getItem('ginkgo-content-v1-'+kind);return raw?validate(kind,JSON.parse(raw)):fallback}catch{return fallback}}
export async function loadContent(kind){
  const response=await fetch(contentRoot+kind+'.json',{cache:'no-cache',signal:AbortSignal.timeout(10000),credentials:'omit'})
  if(!response.ok)throw Error('Content unavailable')
  const raw=await response.json(),items=validate(kind,raw)
  try{localStorage.setItem('ginkgo-content-v1-'+kind,JSON.stringify(raw))}catch{}
  return items
}
