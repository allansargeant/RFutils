import"./index-DiMqSnaD.js";import{getDocument as O}from"./pdf-DfaD4CCm.js";import{w as L}from"./csvUtil-TkXYp5aq.js";function I(){return{licenceNo:"",noticeOfVariationNo:"",licensee:"",licenseeAddress:"",licenceStart:"",licenceEnd:"",pmseRef:"",licenseeRef:"",totalAssignments:0,assignments:[],warnings:[]}}const P=/^([A-Z]{2}\s?\d{3}\s?\d{3})\s+(.*)$/,Z=/([\d.]+)\s*MHz/,G=/([A-Z0-9*]+)\s*\n?\(([^)]+)\)\s*\n?£?([\d.]+)/,U=/([\d:]+),\s*(\d+\s+\w+\s+\d+)\s*\nto\s*\n([\d:]+),\s*(\d+\s+\w+\s+\d+)/m;function S(t){return(t??"").replace(/\n/g," ").trim()}async function V(t){const e=await O({data:t,useSystemFonts:!0}).promise,n=[];for(let _=1;_<=e.numPages;_++){const r=await e.getPage(_),i=r.getViewport({scale:1}),a=await r.getTextContent(),c=[];for(const o of a.items){if(typeof o.str!="string"||o.str==="")continue;const d=o.transform,m=d[4]??0,g=d[5]??0,v=i.height-g;c.push({str:o.str,x:m,y:v,width:o.width??0,height:o.height??0})}const s=F(c);n.push({width:i.width,height:i.height,items:c,lines:s,text:s.map(o=>o.map(d=>d.str).join(" ").replace(/\s+/g," ").trim()).join(`
`)})}return n}function F(t,e=3){const n=[...t].sort((a,c)=>a.y-c.y||a.x-c.x),_=[];let r=[],i=Number.NaN;for(const a of n)r.length===0||Math.abs(a.y-i)<=e?(r.push(a),i=Number.isNaN(i)?a.y:(i+a.y)/2):(_.push(r.sort((c,s)=>c.x-s.x)),r=[a],i=a.y);return r.length&&_.push(r.sort((a,c)=>a.x-c.x)),_}function C(t,e){const n=a=>{const c=a.exec(t);return c?c[1]:null};e.licenceNo=n(/Licence No\s*:\s*([\w/]+)/)??e.licenceNo,e.noticeOfVariationNo=n(/Notice of Variation No\s*:\s*(\d+)/)??e.noticeOfVariationNo;const _=n(/Total assignments\s*:\s*(\d+)/);_&&(e.totalAssignments=parseInt(_,10)),e.licenceStart=n(/Licence Start Date\s*:\s*(\d+\s+\w+\s+\d+)/)??e.licenceStart,e.licenceEnd=n(/Licence End Date\s*:\s*(\d+\s+\w+\s+\d+)/)??e.licenceEnd;const r=n(/PMSE\s*ref\.?\s*:\s*([A-Za-z]?\s*\d+)/);r&&(e.pmseRef=r.replace(/\s+/g,""));const i=/ref\s*\.?\s*:\s*(.+?)\s*;\s*PMSE/.exec(t);i&&(e.licenseeRef=i[1].trim())}function j(t){const e=t.items.filter(_=>_.x>=605&&_.y>=0&&_.y<=130),n=F(e).map(_=>_.map(r=>r.str).join(" ").replace(/\s+/g," ").trim()).filter(_=>_!==""&&_!=="Licensee:");return n.length===0?["",""]:[n[0],n.slice(1).join(", ")]}const Q=[0,128,170,199,227,251,289,311,330,372,690,758],B=/^\d{2,4}\.\d{2,}$/;function W(t){const e=t.width/842,n=Q.map(c=>c*e),_=c=>{let s=0;for(let o=0;o<n.length;o++)c+.5>=n[o]&&(s=o);return s},r=[];let i=null;const a=()=>{i&&r.push(i),i=null};for(const c of t.lines){const s=new Array(n.length).fill("");for(const o of c){const d=_(o.x);s[d]=s[d]?`${s[d]} ${o.str}`:o.str}if(B.test(s[1].trim()))a(),i=s;else if(i)for(let o=0;o<s.length;o++)s[o]&&(i[o]=i[o]?`${i[o]}
${s[o]}`:s[o])}return a(),r}function K(t,e){for(const n of t){if(!n||n.length<12)continue;const _=n[0]??"",r=Z.exec(n[1]??"");if(!r)continue;const i=_.split(`
`).map(y=>y.trim()).filter(Boolean),a=i[0]??"",c=i[1]??"",o=(n[9]??"").split(`
`).filter(y=>y.trim());let d="",m="",g="";if(o.length){const y=P.exec(o[0].trim());y?(d=y[1],m=y[2]):m=o[0].trim(),g=o.slice(1).map(b=>b.trim()).filter(b=>b&&b!=="-").join(" ")}let v="",z="";const u=U.exec(n[10]??"");u&&(v=`${u[1]} ${u[2]}`,z=`${u[3]} ${u[4]}`);let N="",l="",w="";const x=G.exec(n[11]??"");x&&(N=x[1],l=x[2],w=x[3]);const q={equipmentType:a,model:c,frequencyMhz:Math.round(parseFloat(r[1])*1e3)/1e3,bandwidth:S(n[2]),maxPower:S(n[3]),emissionClass:n[4]?S(n[4]).split(" ")[0]:"",ngrTransmit:d,site:m,restrictions:g,periodStart:v,periodEnd:z,feeCategory:N,feeType:l,feeAmount:w};e.assignments.push(q)}}async function Y(t){const e=I(),n=await V(t);n.length&&C(n[0].text,e);for(const _ of n){if(e.licenceNo||C(_.text,e),!e.licensee&&_.text.includes("Licensee:")){const[r,i]=j(_);e.licensee=r,e.licenseeAddress=i}K(W(_),e)}return e.assignments.length===0?e.warnings.push("No frequency assignments could be found in this PDF. It may not be an Ofcom PMSE schedule, or its layout is unrecognized."):e.totalAssignments&&e.assignments.length!==e.totalAssignments&&e.warnings.push(`PDF header states ${e.totalAssignments} assignments but ${e.assignments.length} were parsed. Please verify the output before use.`),e}function k(t){return t.map((e,n)=>{const _=n+1;return`${e.model||e.equipmentType||"Ch"}-${String(_).padStart(2,"0")}`})}function X(t){const e=new Set,n=[];for(const _ of t){const r=_.frequencyMhz.toFixed(3);e.has(r)||(e.add(r),n.push(r))}return n.join(`
`)+`
`}function J(t){const e=[["Index","Suggested Name","Frequency (MHz)","Equipment Type","Model","Coordination/Fee Group","Site","NGR","Period Start","Period End","Restrictions"]],n=k(t);return t.forEach((_,r)=>{e.push([r+1,n[r],_.frequencyMhz.toFixed(3),_.equipmentType,_.model,_.feeCategory,_.site,_.ngrTransmit,_.periodStart,_.periodEnd,_.restrictions])}),L(e)}const e0=`<show version="1.0" source="pmse-to-wwb" date="{{DATE}}" time="{{TIME}}" appl_version="7.8.1.56">
    <show_properties version="1.0">
        <show_info>
            <name>{{SHOW_NAME}}</name>
            <customer>{{CUSTOMER}}</customer>
        </show_info>
        <point_of_contact_info>
            <name>{{POC_NAME}}</name>
            <address/>
            <phone/>
            <email/>
            <remember_poc>false</remember_poc>
            <graphic></graphic>
        </point_of_contact_info>
        <venue_info>
            <name>{{VENUE_NAME}}</name>
            <address>{{VENUE_ADDRESS}}</address>
            <phone/>
            <email/>
        </venue_info>
        <Zone_notes>
            <Zone_name>Room 10</Zone_name>
            <Zone_checked>1</Zone_checked>
            <notes/>
        </Zone_notes>
        <Zone_notes>
            <Zone_name>Room 11</Zone_name>
            <Zone_checked>1</Zone_checked>
            <notes/>
        </Zone_notes>
        <Zone_notes>
            <Zone_name>Room 12</Zone_name>
            <Zone_checked>1</Zone_checked>
            <notes/>
        </Zone_notes>
        <Zone_notes>
            <Zone_name>Room 8/9</Zone_name>
            <Zone_checked>1</Zone_checked>
            <notes/>
        </Zone_notes>
        <Zone_notes>
            <Zone_name>Spare</Zone_name>
            <Zone_checked>1</Zone_checked>
            <notes/>
        </Zone_notes>
        <notes/>
    </show_properties>
    <inventory version="2.1">{{INVENTORY_DEVICES}}</inventory>
    <coordination_info>
        <channel_management version="1.0">
            <channels>{{CHANNEL_IDS}}</channels>
            <active_channel_list sort_order="0" sort_col="-1"/>
            <backup_channel_list sort_order="0" sort_col="-1"/>
        </channel_management>
        <scan_data version="1.3">
            <merged_scans/>
            <threshold>-85</threshold>
            <higher_threshold>-60</higher_threshold>
        </scan_data>
        <channel_exclusions version="1.1">
            <location_info>
                <search_type/>
                <country>United States</country>
                <found_count>0</found_count>
                <found_count>0</found_count>
                <tv_spectrum_format>6 MHz</tv_spectrum_format>
            </location_info>
            <channel_avoidance_info>
                <channel>
                    <number>2</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>54.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>60.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>3</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>60.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>66.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>4</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>66.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>72.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>5</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>76.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>82.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>6</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>82.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>88.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>7</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>174.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>180.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>8</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>180.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>186.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>9</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>186.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>192.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>10</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>192.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>198.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>11</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>198.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>204.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>12</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>204.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>210.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>13</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>210.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>216.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>14</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>470.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>476.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>15</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>476.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>482.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>16</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>482.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>488.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>17</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>488.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>494.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>18</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>494.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>500.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>19</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>500.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>506.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>20</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>506.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>512.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>21</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>512.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>518.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>22</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>518.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>524.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>23</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>524.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>530.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>24</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>530.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>536.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>25</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>536.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>542.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>26</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>542.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>548.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>27</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>548.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>554.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>28</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>554.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>560.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>29</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>560.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>566.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>30</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>566.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>572.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>31</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>572.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>578.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>32</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>578.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>584.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>33</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>584.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>590.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>34</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>590.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>596.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>35</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>596.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>602.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>36</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>602.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>608.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>GB</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>614.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>616.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>DL</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>653.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>657.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
                <channel>
                    <number>DU</number>
                    <call_sign/>
                    <tv_station_country/>
                    <tv_station_latitude/>
                    <tv_station_longitude/>
                    <tv_chann_start_freq>657.000 MHz</tv_chann_start_freq>
                    <tv_chann_end_freq>663.000 MHz</tv_chann_end_freq>
                    <distance>0</distance>
                    <type>4</type>
                    <db_source>0</db_source>
                    <power>0</power>
                    <exclude>false</exclude>
                </channel>
            </channel_avoidance_info>
        </channel_exclusions>
        <band_planning version="1.0">
            <accounted>false</accounted>
            <country>United Kingdom</country>
            <user_group/>
            <band_plan_accounted>true</band_plan_accounted>
        </band_planning>
    </coordination_info>
    <CFLs version="1.0"/>
    <plot_info>
        <coordination_plot version="1.2">
            <plots/>
            <start>30.000 MHz</start>
            <center>1015.000 MHz</center>
            <end>2000.000 MHz</end>
            <span>1970.000 MHz</span>
        </coordination_plot>
    </plot_info>
    <custom_user_group_list>
        <inclusion_list version="1.0" name="Custom" uuid="1d4ae7ca-f903-49b9-8d97-2ccc2969b518" active="false"/>
    </custom_user_group_list>
    <band_plan_group_list version="1.0">
        <band_plan_list version="1.0" name="{{BAND_PLAN_NAME}}" uuid="3b734f9f-2807-448c-aa02-1362c14e5796" active="true">
            <inclusion_group version="1.0" color="#585858" name="{{GROUP_NAME}}" uuid="ca506d69-2753-40b8-9311-cd00d9da162b">
                <freqs units="KHz" count="{{INCL_FREQ_COUNT}}">{{INCL_FREQS}}</freqs>
                <freq_ranges units="KHz" count="0"/>
            </inclusion_group>
        </band_plan_list>
    </band_plan_group_list>
    <coordinated_data_root version="0.3" id="d2897d8d-02fe-4009-bac9-625c0df18fea">
        <mic_channels units="khz" count="{{MIC_CHANNEL_COUNT}}">{{FREQ_ENTRIES}}</mic_channels>
        <compatibility_profile_settings version="1.0" count="{{PROFILE_COUNT}}">{{COMPAT_PROFILES}}</compatibility_profile_settings>
        <keys_coord_order version="1.1">
            <profile>
                <band>G56</band>
                <series>AD</series>
                <tx_profile>Standard</tx_profile>
                <zone/>
                <incl_group>ca506d69-2753-40b8-9311-cd00d9da162b</incl_group>
                <coord_order>100912201</coord_order>
            </profile>
        </keys_coord_order>
    </coordinated_data_root>
    <monitoring_info version="2.2">
        <channel_order/>
        <charger_order/>
        <chooser_widget id="1">
            <sort_section>2</sort_section>
            <sort_order>0</sort_order>
        </chooser_widget>
        <chooser_widget id="2">
            <sort_section>4</sort_section>
            <sort_order>0</sort_order>
        </chooser_widget>
        <device_chooser_layout>0,0,0,0,0,0</device_chooser_layout>
        <device_chooser_selection>0,1,0,0,0,0</device_chooser_selection>
        <strip_parameters>
            <enabled_options>CS_GraphicsChannelNameNetworkLockWidget,CS_FrequencyTvChannelWidget,CS_GraphicsRfAudioWidget,CS_TxInfoWidget,CS_GraphicsRfPowerContainer,CS_GraphicsEncryptionContainer,CS_GraphicsBatteryAudioModeWidget,CS_GraphicsCarouselContainer,CS_GraphicsChargerStripView,CS_GraphicsAccessPointStripView</enabled_options>
        </strip_parameters>
        <autolog_parameters>
            <enabled_plots>22,7,1,25,3,27,28,26,8,9,10,11,29,30,13,14,24</enabled_plots>
            <plot_view_mode>4</plot_view_mode>
        </autolog_parameters>
        <monitoring_pager version="1.1">
            <view id="{d538df38-b495-46d6-968a-efd9bc53c107}" name="View 1" active="true"/>
        </monitoring_pager>
        <monitoring_registry version="1.1">
            <view id="{d538df38-b495-46d6-968a-efd9bc53c107}">
                <registry arrange_mode="0"/>
            </view>
        </monitoring_registry>
    </monitoring_info>
</show>
`,t0=`<device>
            <id dcid="04DFAE08-FD5A-11E3-A18A-0015C5F3F612">83DD8AE3-F353-4378-B294-69C905285801</id>
            <series>AD</series>
            <model type="10">AD4Q-A</model>
            <manufacturer type="10">Shure</manufacturer>
            <production_id type="10"></production_id>
            <firmware_version type="12">0000000000000000</firmware_version>
            <firmware_version_valid type="1">false</firmware_version_valid>
            <firmware_version_hosted type="12">0000000000000000</firmware_version_hosted>
            <device_name type="10"><![CDATA[AD4Q-A]]></device_name>
            <mac_address type="12"></mac_address>
            <ip_mode type="3">0</ip_mode>
            <ip_address type="3">0</ip_address>
            <ip_subnet type="3">0</ip_subnet>
            <ip_gateway type="3">0</ip_gateway>
            <scan_freq_step_capability type="10">No Capability</scan_freq_step_capability>
            <scan_rbw_capability type="10">No Capability</scan_rbw_capability>
            <start type="3">0</start>
            <end type="3">0</end>
            <band type="10">G56</band>
            <custom_group_channel1 type="12">000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</custom_group_channel1>
            <custom_group_channel2 type="12">000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</custom_group_channel2>
            <custom_group_channel3 type="12">000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</custom_group_channel3>
            <custom_group_channel4 type="12">000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</custom_group_channel4>
            <custom_group_channel5 type="12">000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</custom_group_channel5>
            <custom_group_channel6 type="12">000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</custom_group_channel6>
            <cid_of_freq_server type="12">00000000-0000-0000-0000-000000000000</cid_of_freq_server>
            <name_of_freq_server type="10">None</name_of_freq_server>
            <front_panel_lock type="1">false</front_panel_lock>
            <power_lock type="1">false</power_lock>
            <dc_power type="3">1</dc_power>
            <zone type="12">Room 8/9</zone>
            <fan_mode type="3">0</fan_mode>
            <world_clock_set_rate type="3">48000</world_clock_set_rate>
            <world_clock_ext_rate type="3">0</world_clock_ext_rate>
            <audio_encryption_mode type="3">0</audio_encryption_mode>
            <modem_mode type="3">0</modem_mode>
            <quadversity_mode type="3">0</quadversity_mode>
            <dante_primary_network_mode type="3">0</dante_primary_network_mode>
            <dante_primary_ip_address type="3">0</dante_primary_ip_address>
            <dante_primary_mac_address type="12"></dante_primary_mac_address>
            <dante_primary_subnet_mask type="3">0</dante_primary_subnet_mask>
            <dante_primary_default_gateway type="3">0</dante_primary_default_gateway>
            <dante_ip_address_static_primary type="3">0</dante_ip_address_static_primary>
            <dante_ip_subnet_static_primary type="3">0</dante_ip_subnet_static_primary>
            <dante_ip_gateway_static_primary type="3">0</dante_ip_gateway_static_primary>
            <aes3_switch type="3">0</aes3_switch>
            <dc_module type="2">-1</dc_module>
            <channel number="1">
                <channel_name type="10"><![CDATA[Shure]]></channel_name>
                <color type="3">5789784</color>
                <audio_gain type="2">12</audio_gain>
                <audio_mute type="1">false</audio_mute>
                <ground_lift_sw type="1">false</ground_lift_sw>
                <child1_id type="12">00000000-0000-0000-0000-000000000000</child1_id>
                <child2_id type="12">00000000-0000-0000-0000-000000000000</child2_id>
                <child3_id type="12">00000000000000000000000000000000</child3_id>
                <child4_id type="12">00000000000000000000000000000000</child4_id>
                <child5_id type="12">00000000000000000000000000000000</child5_id>
                <child6_id type="12">00000000000000000000000000000000</child6_id>
                <child7_id type="12">00000000000000000000000000000000</child7_id>
                <child8_id type="12">00000000000000000000000000000000</child8_id>
                <frequency type="3">550375</frequency>
                <diversity type="3">0</diversity>
                <interference_mode type="3">1</interference_mode>
                <interference_sensitivity type="3">0</interference_sensitivity>
                <remote_name type="10">RemChannel1</remote_name>
                <incl_group type="12">ca506d69-2753-40b8-9311-cd00d9da162b</incl_group>
                <ir_sync_audio_mute_switch type="3">255</ir_sync_audio_mute_switch>
                <ir_sync_tx_sensitivity type="2">-1</ir_sync_tx_sensitivity>
                <ir_sync_tx_power type="3">255</ir_sync_tx_power>
                <ir_sync_remote_lock type="3">255</ir_sync_remote_lock>
                <ir_sync_bat_type type="3">255</ir_sync_bat_type>
                <ir_sync_custom_groups type="3">0</ir_sync_custom_groups>
                <rf_scaling_factor type="3">10</rf_scaling_factor>
                <audio_out_level_switch type="3">0</audio_out_level_switch>
                <audio_peak_hold type="1">false</audio_peak_hold>
                <ir_sync_handheld_offset type="2">-128</ir_sync_handheld_offset>
                <ir_sync_bodypack_offset type="2">-128</ir_sync_bodypack_offset>
                <unregistered_tx_mode type="3">1</unregistered_tx_mode>
                <regtx1_id type="12">00000000000000000000000000000000</regtx1_id>
                <regtx2_id type="12">00000000000000000000000000000000</regtx2_id>
                <regtx3_id type="12">00000000000000000000000000000000</regtx3_id>
                <regtx4_id type="12">00000000000000000000000000000000</regtx4_id>
                <regtx5_id type="12">00000000000000000000000000000000</regtx5_id>
                <regtx6_id type="12">00000000000000000000000000000000</regtx6_id>
                <regtx7_id type="12">00000000000000000000000000000000</regtx7_id>
                <regtx8_id type="12">00000000000000000000000000000000</regtx8_id>
                <regtx1_name type="10"></regtx1_name>
                <regtx2_name type="10"></regtx2_name>
                <regtx3_name type="10"></regtx3_name>
                <regtx4_name type="10"></regtx4_name>
                <regtx5_name type="10"></regtx5_name>
                <regtx6_name type="10"></regtx6_name>
                <regtx7_name type="10"></regtx7_name>
                <regtx8_name type="10"></regtx8_name>
                <tone_gen_level type="2">-128</tone_gen_level>
                <tone_gen_freq type="3">400</tone_gen_freq>
                <ir_sync_tx_polarity type="3">255</ir_sync_tx_polarity>
                <ir_sync_plugon_phantom_power type="3">255</ir_sync_plugon_phantom_power>
                <ir_sync_plugon_offset type="2">-128</ir_sync_plugon_offset>
                <ir_sync_plugon_high_pass_filter type="3">255</ir_sync_plugon_high_pass_filter>
                <ir_sync_plugon_tx_sensitivity type="2">-1</ir_sync_plugon_tx_sensitivity>
                <tags type="10"></tags>
                <group_channel type="10">--,--</group_channel>
            </channel>
            <channel number="2">
                <channel_name type="10"><![CDATA[Shure]]></channel_name>
                <color type="3">5789784</color>
                <audio_gain type="2">12</audio_gain>
                <audio_mute type="1">false</audio_mute>
                <ground_lift_sw type="1">false</ground_lift_sw>
                <child1_id type="12">00000000-0000-0000-0000-000000000000</child1_id>
                <child2_id type="12">00000000-0000-0000-0000-000000000000</child2_id>
                <child3_id type="12">00000000000000000000000000000000</child3_id>
                <child4_id type="12">00000000000000000000000000000000</child4_id>
                <child5_id type="12">00000000000000000000000000000000</child5_id>
                <child6_id type="12">00000000000000000000000000000000</child6_id>
                <child7_id type="12">00000000000000000000000000000000</child7_id>
                <child8_id type="12">00000000000000000000000000000000</child8_id>
                <frequency type="3">551625</frequency>
                <diversity type="3">0</diversity>
                <interference_mode type="3">1</interference_mode>
                <interference_sensitivity type="3">0</interference_sensitivity>
                <remote_name type="10">RemChannel2</remote_name>
                <incl_group type="12">ca506d69-2753-40b8-9311-cd00d9da162b</incl_group>
                <ir_sync_audio_mute_switch type="3">255</ir_sync_audio_mute_switch>
                <ir_sync_tx_sensitivity type="2">-1</ir_sync_tx_sensitivity>
                <ir_sync_tx_power type="3">255</ir_sync_tx_power>
                <ir_sync_remote_lock type="3">255</ir_sync_remote_lock>
                <ir_sync_bat_type type="3">255</ir_sync_bat_type>
                <ir_sync_custom_groups type="3">0</ir_sync_custom_groups>
                <rf_scaling_factor type="3">10</rf_scaling_factor>
                <audio_out_level_switch type="3">0</audio_out_level_switch>
                <audio_peak_hold type="1">false</audio_peak_hold>
                <ir_sync_handheld_offset type="2">-128</ir_sync_handheld_offset>
                <ir_sync_bodypack_offset type="2">-128</ir_sync_bodypack_offset>
                <unregistered_tx_mode type="3">1</unregistered_tx_mode>
                <regtx1_id type="12">00000000000000000000000000000000</regtx1_id>
                <regtx2_id type="12">00000000000000000000000000000000</regtx2_id>
                <regtx3_id type="12">00000000000000000000000000000000</regtx3_id>
                <regtx4_id type="12">00000000000000000000000000000000</regtx4_id>
                <regtx5_id type="12">00000000000000000000000000000000</regtx5_id>
                <regtx6_id type="12">00000000000000000000000000000000</regtx6_id>
                <regtx7_id type="12">00000000000000000000000000000000</regtx7_id>
                <regtx8_id type="12">00000000000000000000000000000000</regtx8_id>
                <regtx1_name type="10"></regtx1_name>
                <regtx2_name type="10"></regtx2_name>
                <regtx3_name type="10"></regtx3_name>
                <regtx4_name type="10"></regtx4_name>
                <regtx5_name type="10"></regtx5_name>
                <regtx6_name type="10"></regtx6_name>
                <regtx7_name type="10"></regtx7_name>
                <regtx8_name type="10"></regtx8_name>
                <tone_gen_level type="2">-128</tone_gen_level>
                <tone_gen_freq type="3">400</tone_gen_freq>
                <ir_sync_tx_polarity type="3">255</ir_sync_tx_polarity>
                <ir_sync_plugon_phantom_power type="3">255</ir_sync_plugon_phantom_power>
                <ir_sync_plugon_offset type="2">-128</ir_sync_plugon_offset>
                <ir_sync_plugon_high_pass_filter type="3">255</ir_sync_plugon_high_pass_filter>
                <ir_sync_plugon_tx_sensitivity type="2">-1</ir_sync_plugon_tx_sensitivity>
                <tags type="10"></tags>
                <group_channel type="10">--,--</group_channel>
            </channel>
            <channel number="3">
                <channel_name type="10"><![CDATA[Shure]]></channel_name>
                <color type="3">5789784</color>
                <audio_gain type="2">12</audio_gain>
                <audio_mute type="1">false</audio_mute>
                <ground_lift_sw type="1">false</ground_lift_sw>
                <child1_id type="12">00000000-0000-0000-0000-000000000000</child1_id>
                <child2_id type="12">00000000-0000-0000-0000-000000000000</child2_id>
                <child3_id type="12">00000000000000000000000000000000</child3_id>
                <child4_id type="12">00000000000000000000000000000000</child4_id>
                <child5_id type="12">00000000000000000000000000000000</child5_id>
                <child6_id type="12">00000000000000000000000000000000</child6_id>
                <child7_id type="12">00000000000000000000000000000000</child7_id>
                <child8_id type="12">00000000000000000000000000000000</child8_id>
                <frequency type="3">551125</frequency>
                <diversity type="3">0</diversity>
                <interference_mode type="3">1</interference_mode>
                <interference_sensitivity type="3">0</interference_sensitivity>
                <remote_name type="10">RemChannel3</remote_name>
                <incl_group type="12">ca506d69-2753-40b8-9311-cd00d9da162b</incl_group>
                <ir_sync_audio_mute_switch type="3">255</ir_sync_audio_mute_switch>
                <ir_sync_tx_sensitivity type="2">-1</ir_sync_tx_sensitivity>
                <ir_sync_tx_power type="3">255</ir_sync_tx_power>
                <ir_sync_remote_lock type="3">255</ir_sync_remote_lock>
                <ir_sync_bat_type type="3">255</ir_sync_bat_type>
                <ir_sync_custom_groups type="3">0</ir_sync_custom_groups>
                <rf_scaling_factor type="3">10</rf_scaling_factor>
                <audio_out_level_switch type="3">0</audio_out_level_switch>
                <audio_peak_hold type="1">false</audio_peak_hold>
                <ir_sync_handheld_offset type="2">-128</ir_sync_handheld_offset>
                <ir_sync_bodypack_offset type="2">-128</ir_sync_bodypack_offset>
                <unregistered_tx_mode type="3">1</unregistered_tx_mode>
                <regtx1_id type="12">00000000000000000000000000000000</regtx1_id>
                <regtx2_id type="12">00000000000000000000000000000000</regtx2_id>
                <regtx3_id type="12">00000000000000000000000000000000</regtx3_id>
                <regtx4_id type="12">00000000000000000000000000000000</regtx4_id>
                <regtx5_id type="12">00000000000000000000000000000000</regtx5_id>
                <regtx6_id type="12">00000000000000000000000000000000</regtx6_id>
                <regtx7_id type="12">00000000000000000000000000000000</regtx7_id>
                <regtx8_id type="12">00000000000000000000000000000000</regtx8_id>
                <regtx1_name type="10"></regtx1_name>
                <regtx2_name type="10"></regtx2_name>
                <regtx3_name type="10"></regtx3_name>
                <regtx4_name type="10"></regtx4_name>
                <regtx5_name type="10"></regtx5_name>
                <regtx6_name type="10"></regtx6_name>
                <regtx7_name type="10"></regtx7_name>
                <regtx8_name type="10"></regtx8_name>
                <tone_gen_level type="2">-128</tone_gen_level>
                <tone_gen_freq type="3">400</tone_gen_freq>
                <ir_sync_tx_polarity type="3">255</ir_sync_tx_polarity>
                <ir_sync_plugon_phantom_power type="3">255</ir_sync_plugon_phantom_power>
                <ir_sync_plugon_offset type="2">-128</ir_sync_plugon_offset>
                <ir_sync_plugon_high_pass_filter type="3">255</ir_sync_plugon_high_pass_filter>
                <ir_sync_plugon_tx_sensitivity type="2">-1</ir_sync_plugon_tx_sensitivity>
                <tags type="10"></tags>
                <group_channel type="10">--,--</group_channel>
            </channel>
            <channel number="4">
                <channel_name type="10"><![CDATA[Shure]]></channel_name>
                <color type="3">5789784</color>
                <audio_gain type="2">12</audio_gain>
                <audio_mute type="1">false</audio_mute>
                <ground_lift_sw type="1">false</ground_lift_sw>
                <child1_id type="12">00000000-0000-0000-0000-000000000000</child1_id>
                <child2_id type="12">00000000-0000-0000-0000-000000000000</child2_id>
                <child3_id type="12">00000000000000000000000000000000</child3_id>
                <child4_id type="12">00000000000000000000000000000000</child4_id>
                <child5_id type="12">00000000000000000000000000000000</child5_id>
                <child6_id type="12">00000000000000000000000000000000</child6_id>
                <child7_id type="12">00000000000000000000000000000000</child7_id>
                <child8_id type="12">00000000000000000000000000000000</child8_id>
                <frequency type="3">554875</frequency>
                <diversity type="3">0</diversity>
                <interference_mode type="3">1</interference_mode>
                <interference_sensitivity type="3">0</interference_sensitivity>
                <remote_name type="10">RemChannel4</remote_name>
                <incl_group type="12">ca506d69-2753-40b8-9311-cd00d9da162b</incl_group>
                <ir_sync_audio_mute_switch type="3">255</ir_sync_audio_mute_switch>
                <ir_sync_tx_sensitivity type="2">-1</ir_sync_tx_sensitivity>
                <ir_sync_tx_power type="3">255</ir_sync_tx_power>
                <ir_sync_remote_lock type="3">255</ir_sync_remote_lock>
                <ir_sync_bat_type type="3">255</ir_sync_bat_type>
                <ir_sync_custom_groups type="3">0</ir_sync_custom_groups>
                <rf_scaling_factor type="3">10</rf_scaling_factor>
                <audio_out_level_switch type="3">0</audio_out_level_switch>
                <audio_peak_hold type="1">false</audio_peak_hold>
                <ir_sync_handheld_offset type="2">-128</ir_sync_handheld_offset>
                <ir_sync_bodypack_offset type="2">-128</ir_sync_bodypack_offset>
                <unregistered_tx_mode type="3">1</unregistered_tx_mode>
                <regtx1_id type="12">00000000000000000000000000000000</regtx1_id>
                <regtx2_id type="12">00000000000000000000000000000000</regtx2_id>
                <regtx3_id type="12">00000000000000000000000000000000</regtx3_id>
                <regtx4_id type="12">00000000000000000000000000000000</regtx4_id>
                <regtx5_id type="12">00000000000000000000000000000000</regtx5_id>
                <regtx6_id type="12">00000000000000000000000000000000</regtx6_id>
                <regtx7_id type="12">00000000000000000000000000000000</regtx7_id>
                <regtx8_id type="12">00000000000000000000000000000000</regtx8_id>
                <regtx1_name type="10"></regtx1_name>
                <regtx2_name type="10"></regtx2_name>
                <regtx3_name type="10"></regtx3_name>
                <regtx4_name type="10"></regtx4_name>
                <regtx5_name type="10"></regtx5_name>
                <regtx6_name type="10"></regtx6_name>
                <regtx7_name type="10"></regtx7_name>
                <regtx8_name type="10"></regtx8_name>
                <tone_gen_level type="2">-128</tone_gen_level>
                <tone_gen_freq type="3">400</tone_gen_freq>
                <ir_sync_tx_polarity type="3">255</ir_sync_tx_polarity>
                <ir_sync_plugon_phantom_power type="3">255</ir_sync_plugon_phantom_power>
                <ir_sync_plugon_offset type="2">-128</ir_sync_plugon_offset>
                <ir_sync_plugon_high_pass_filter type="3">255</ir_sync_plugon_high_pass_filter>
                <ir_sync_plugon_tx_sensitivity type="2">-1</ir_sync_plugon_tx_sensitivity>
                <tags type="10"></tags>
                <group_channel type="10">--,--</group_channel>
            </channel>
        </device>`,n0=`<profile>
                <band>G56</band>
                <series>AD</series>
                <tx_profile>Standard</tx_profile>
                <zone>Room 10</zone>
                <incl_group>ca506d69-2753-40b8-9311-cd00d9da162b</incl_group>
                <compat_profile version="0.0.0.1" id="f1e4f397-b27b-f54e-f620-03c401dbfd5f" synthesizable="1" imd_source="1" name="Standard">
                    <spacing freq_units="KHz">
                        <ch_ch>350</ch_ch>
                        <imd_2t3o>75</imd_2t3o>
                        <imd_2t5o>0</imd_2t5o>
                        <imd_2t7o>0</imd_2t7o>
                        <imd_2t9o>0</imd_2t9o>
                        <imd_3t3o>0</imd_3t3o>
                    </spacing>
                    <filter type="1">
                        <filter_start>-70000</filter_start>
                        <filter_end>70000</filter_end>
                        <filter_center>0</filter_center>
                    </filter>
                </compat_profile>
            </profile>`,_0=`<freq_entry id="83DD8AE3-F353-4378-B294-69C905285801-0" color="#585858" tag="">
                <compat_key>
                    <zone>Room 8/9</zone>
                    <series>AD</series>
                    <band>G56</band>
                    <mode>Standard</mode>
                    <incl_group>ca506d69-2753-40b8-9311-cd00d9da162b</incl_group>
                </compat_key>
                <compat_prof_id>12d5c796-607d-dc3a-5ed2-a1454ca0c0d9</compat_prof_id>
                <value>578875</value>
                <gr_ch>G:-- Ch:--</gr_ch>
                <context_role>7</context_role>
                <origin>0</origin>
                <compat_level>0</compat_level>
                <coord_order>100912201</coord_order>
                <imd_source>1</imd_source>
                <vip>0</vip>
                <synth_status>1</synth_status>
                <chann_num>0</chann_num>
                <diversity div_mode="0" div_partner_id="-1"/>
                <model>AD4Q-A</model>
                <manufacturer>Shure</manufacturer>
                <source_id>83DD8AE3-F353-4378-B294-69C905285801-0</source_id>
                <source_name>Shure</source_name>
                <dev_category>
                    <dev_type>Receiver</dev_type>
                    <dev_type>Microphone</dev_type>
                    <dev_type>Rack</dev_type>
                </dev_category>
            </freq_entry>`,M=4,r0="Unused",T="83DD8AE3-F353-4378-B294-69C905285801",i0="Room 8/9",R=["550375","551625","551125","554875"],c0='<channel_name type="10"><![CDATA[Shure]]></channel_name>',D=`${T}-0`,o0="Room 8/9",a0="578875",s0="0",d0="Room 10";function h(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function l0(t){return`<![CDATA[${String(t).replace(/]]>/g,"]] >")}]]>`}function p0(){const t=globalThis.crypto;if(typeof(t==null?void 0:t.randomUUID)=="function")return t.randomUUID().toUpperCase();const e=new Uint8Array(16);t.getRandomValues(e),e[6]=e[6]&15|64,e[8]=e[8]&63|128;const n=Array.from(e,_=>_.toString(16).padStart(2,"0")).join("");return[n.slice(0,8),n.slice(8,12),n.slice(12,16),n.slice(16,20),n.slice(20)].join("-").toUpperCase()}function f(t,e,n){const _=t.indexOf(e);return _===-1?t:t.slice(0,_)+n+t.slice(_+e.length)}function u0(t,e,n,_){let r=f(t0,`<id dcid="04DFAE08-FD5A-11E3-A18A-0015C5F3F612">${T}</id>`,`<id dcid="04DFAE08-FD5A-11E3-A18A-0015C5F3F612">${t}</id>`);r=f(r,`<zone type="12">${i0}</zone>`,`<zone type="12">${h(e)}</zone>`);const i=r.split(c0);if(i.length!==M+1)throw new Error("device template channel_name pattern not found as expected");let a=i[0];for(let c=0;c<M;c++){const s=c<_.length?_[c]:r0;a+=`<channel_name type="10">${l0(s)}</channel_name>`,a+=i[c+1]}r=a;for(let c=0;c<R.length;c++){const s=R[c],o=c<n.length?n[c]:s;r=f(r,`<frequency type="3">${s}</frequency>`,`<frequency type="3">${o}</frequency>`)}return r}function y0(t,e,n,_){const r=`${t}-${e}`;let i=f(_0,`id="${D}"`,`id="${r}"`);return i=f(i,`<zone>${o0}</zone>`,`<zone>${h(_)}</zone>`),i=f(i,`<value>${a0}</value>`,`<value>${n}</value>`),i=f(i,`<chann_num>${s0}</chann_num>`,`<chann_num>${e}</chann_num>`),i=f(i,`<source_id>${D}</source_id>`,`<source_id>${r}</source_id>`),i}function h0(t){return f(n0,`<zone>${d0}</zone>`,`<zone>${h(t)}</zone>`)}function f0(t,e){const n=[];for(let _=0;_<t.length;_+=e)n.push(t.slice(_,_+e));return n}const m0=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],g0=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],H=t=>String(t).padStart(2,"0");function v0(t){return`${m0[t.getDay()]} ${g0[t.getMonth()]} ${H(t.getDate())} ${t.getFullYear()}`}function x0(t){return`${H(t.getHours())}:${H(t.getMinutes())}:${H(t.getSeconds())}`}function b0(t,e={}){const n=e.showName??"PMSE Licence Import",_=e.customer??"",r=e.pocName??"",i=e.venueName??"",a=e.venueAddress??"",c=e.now??new Date,s=f0(t,M),o=[],d=[],m=[],g=[],v=[];s.forEach((l,w)=>{const x=p0(),q=w*M+1,y=q+l.length-1,A=l.length>1?`Ch ${q}-${y}`:`Ch ${q}`,b=l.map(p=>String(Math.round(p.frequencyMhz*1e3))),$=l.map((p,E)=>p.suggestedName||`Ch${q+E}`);o.push(u0(x,A,b,$));for(let p=0;p<M;p++){const E=p<l.length;d.push(`<id active_channel="${E?"true":"false"}" coordination_include="${E?"true":"false"}">${x}-${p}</id>`),E&&(m.push(y0(x,p,b[p],A)),v.push(b[p]))}g.push(h0(A))});const z=s.length*M;let u=e0;const N={"{{SHOW_NAME}}":h(n),"{{CUSTOMER}}":h(_),"{{POC_NAME}}":h(r),"{{VENUE_NAME}}":h(i),"{{VENUE_ADDRESS}}":h(a),"{{BAND_PLAN_NAME}}":h(n).slice(0,40)||"List 1","{{GROUP_NAME}}":"Ofcom Licence","{{DATE}}":v0(c),"{{TIME}}":x0(c),"{{INVENTORY_DEVICES}}":o.join(""),"{{CHANNEL_IDS}}":d.join(""),"{{MIC_CHANNEL_COUNT}}":String(z),"{{FREQ_ENTRIES}}":m.join(""),"{{PROFILE_COUNT}}":String(g.length),"{{COMPAT_PROFILES}}":g.join(""),"{{INCL_FREQ_COUNT}}":String(v.length),"{{INCL_FREQS}}":v.map(l=>`<f>${l}</f>`).join("")};for(const[l,w]of Object.entries(N))u=u.split(l).join(w);return u}async function E0(t){var _;const e=await Y(t),n=k(e.assignments);return e.assignments.forEach((r,i)=>{r.suggestedName=n[i]}),{metadata:{licenceNo:e.licenceNo,noticeOfVariationNo:e.noticeOfVariationNo,licensee:e.licensee,licenseeAddress:e.licenseeAddress,licenceStart:e.licenceStart,licenceEnd:e.licenceEnd,pmseRef:e.pmseRef,licenseeRef:e.licenseeRef,totalAssignments:e.totalAssignments},warnings:e.warnings,assignmentCount:e.assignments.length,assignments:e.assignments.map(r=>({frequencyMhz:r.frequencyMhz,equipmentType:r.equipmentType,model:r.model,feeCategory:r.feeCategory,site:r.site,suggestedName:r.suggestedName})),wwbFrequencyList:X(e.assignments),referenceCsv:J(e.assignments),wwbShowFile:b0(e.assignments,{showName:e.licenceNo?`Licence ${e.licenceNo}`:"PMSE Import",customer:e.licensee,venueName:((_=e.assignments[0])==null?void 0:_.site)??""})}}export{E0 as convertLicence,b0 as generateShow,Y as parseLicencePdf,k as suggestedNames,J as toReferenceCsv,X as toWwbFrequencyList};
