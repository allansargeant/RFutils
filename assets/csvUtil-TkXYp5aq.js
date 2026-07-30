function l(n,e=","){const r=[];let t=[],s="",u=!1,i=0;const f=()=>{t.push(s),s=""},c=()=>{f(),r.push(t),t=[]};for(;i<n.length;){const o=n[i];if(u){if(o==='"'){if(n[i+1]==='"'){s+='"',i+=2;continue}u=!1,i++;continue}s+=o,i++;continue}if(o==='"'){u=!0,i++;continue}if(o===e){f(),i++;continue}if(o==="\r"){n[i+1]===`
`&&i++,c(),i++;continue}if(o===`
`){c(),i++;continue}s+=o,i++}return(s!==""||t.length>0)&&c(),r}function h(n,e=","){return l(n,e).filter(r=>r.some(t=>t.trim()!==""))}function p(n,e){return n.includes(e)||n.includes('"')||n.includes(`
`)||n.includes("\r")}function d(n,e){return p(n,e)?'"'+n.replace(/"/g,'""')+'"':n}function a(n,e=","){return n.map(r=>r.map(t=>d(String(t),e)).join(e)).join(`\r
`)+`\r
`}export{l as a,h as p,a as w};
