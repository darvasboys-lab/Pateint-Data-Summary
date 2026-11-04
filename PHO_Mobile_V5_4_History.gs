
/**
 * PGICH PHO/BMT Medication Audit
 * V5.2 — Smart Summary + Golden Update Notification
 * Existing Google Sheet and patient archive are preserved.
 */

const PHO_MOBILE_CONFIG = Object.freeze({
  spreadsheetId:PropertiesService.getScriptProperties().getProperty('PHO_SPREADSHEET_ID') || '',
  entry:'Daily Checklist',
  archive:'Patient Records',
  lists:'Audit Lists',
  history:'_Audit Revisions',
  timezone:'Asia/Kolkata',
  first:8,
  count:70,
  listSize:150,
  cols:19
});

// Increase this value for every new deployment.
const PHO_MOBILE_RELEASE = '2026.11.04.1';
const PHO_PUBLISHED_RELEASE_PROPERTY = 'PHO_PUBLISHED_RELEASE';

function doGet() {
  phoMobilePublishRelease_();
  const page=HtmlService.createTemplateFromFile('PHO_Mobile_UI');
  page.phoClientRelease=PHO_MOBILE_RELEASE;
  return page.evaluate()
    .setTitle('PGICH | Mobile Patient Audit')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}

function phoMobileCheckUpdate() {
  const published=PropertiesService.getScriptProperties()
    .getProperty(PHO_PUBLISHED_RELEASE_PROPERTY);
  return {
    release:published||PHO_MOBILE_RELEASE,
    url:ScriptApp.getService().getUrl()||''
  };
}

function phoMobileCompareRelease_(a,b) {
  const x=String(a||'').split('.').map(Number);
  const y=String(b||'').split('.').map(Number);
  for(let i=0;i<Math.max(x.length,y.length);i++){
    const diff=(x[i]||0)-(y[i]||0);
    if(diff!==0)return diff>0?1:-1;
  }
  return 0;
}

function phoMobilePublishRelease_() {
  const props=PropertiesService.getScriptProperties();
  const old=props.getProperty(PHO_PUBLISHED_RELEASE_PROPERTY)||'';
  if(!old||phoMobileCompareRelease_(PHO_MOBILE_RELEASE,old)>0){
    props.setProperty(PHO_PUBLISHED_RELEASE_PROPERTY,PHO_MOBILE_RELEASE);
  }
  return props.getProperty(PHO_PUBLISHED_RELEASE_PROPERTY);
}

function phoMobileToday_() {
  return Utilities.formatDate(
    new Date(),PHO_MOBILE_CONFIG.timezone,'yyyy-MM-dd'
  );
}

function phoMobileNow_() {
  return Utilities.formatDate(
    new Date(),PHO_MOBILE_CONFIG.timezone,'yyyy-MM-dd HH:mm:ss'
  )+' IST';
}

function phoMobileSS_(requireV3) {
  const ss=SpreadsheetApp.openById(PHO_MOBILE_CONFIG.spreadsheetId);
  const entry=ss.getSheetByName(PHO_MOBILE_CONFIG.entry);
  const archive=ss.getSheetByName(PHO_MOBILE_CONFIG.archive);
  const lists=ss.getSheetByName(PHO_MOBILE_CONFIG.lists);
  const history=ss.getSheetByName(PHO_MOBILE_CONFIG.history);

  if(!entry||!archive||!lists||!history||
     !ss.getSheetByName('Form Responses 1')||
     entry.getRange('A7').getDisplayValue()!=='No.'||
     entry.getRange('N7').getDisplayValue()!=='SAVE ✓'||
     archive.getRange('A1').getDisplayValue()!=='Record ID'){
    throw new Error(
      'Existing PGICH spreadsheet structure not recognized. No changes made.'
    );
  }

  if(requireV3&&(
     entry.getRange('R7').getDisplayValue()!=='Patient Name'||
     entry.getRange('S7').getDisplayValue()!=='Name audit date'||
     archive.getRange('T1').getDisplayValue()!=='Patient Name'||
     lists.getRange('G1').getDisplayValue()!=='Clinical Pharmacist'||
     lists.getRange('H1').getDisplayValue()!=='Bed cubicle (optional)'
  )){
    throw new Error('V3 setup incomplete. Run phoMobileInstallV3 once.');
  }
  return ss;
}

function phoMobileLock_(){
  return LockService.getDocumentLock()||LockService.getScriptLock();
}

function phoMobileClean_(value,max,label){
  const s=String(
    value===null||value===undefined?'':value
  ).trim();

  if(s.length>max){
    throw new Error(label+' exceeds '+max+' characters.');
  }
  if(/^[=+@]/.test(s)||
     /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)){
    throw new Error(label+' contains unsupported characters.');
  }
  return s;
}

function phoMobileStr_(x){
  return x===null||x===undefined?'':String(x);
}

const PHO_FIXED_WARDS=Object.freeze([
  'PHO','BMT','Daycare','4th Floor','Private I','Private II'
]);

const PHO_FIXED_ERRORS=Object.freeze([
  'Prescription error','Transcription error','Dispensing error',
  'Administration error','Storage error','Others'
]);

function phoMobileValidateLocation_(data,existing,options){
  const oldLocation=existing&&
    String(existing[14])==='Saved'&&
    String(existing[1])===data.ward&&
    String(existing[2])===data.cubic&&
    String(existing[3])===data.bed;

  if(oldLocation&&PHO_FIXED_WARDS.indexOf(data.ward)===-1){
    return;
  }

  let valid=false;

  if(data.ward==='PHO'){
    valid=/^[A-F]$/.test(data.cubic)&&
      data.bed===data.cubic+String(Number(data.bed.slice(1)))&&
      /^[A-F][1-4]$/.test(data.bed);
  }else if(data.cubic==='N/A'){
    if(data.ward==='BMT'){
      valid=/^BMT-(?:[1-9]|10)$/.test(data.bed);
    }
    if(data.ward==='Daycare'){
      valid=/^DC-(?:[1-9]|1[0-9]|20)$/.test(data.bed);
    }
    if(data.ward==='4th Floor'){
      valid=/^4F-(?:[1-9]|1[0-5])$/.test(data.bed);
    }
    if(data.ward==='Private I'){
      valid=data.bed==='Private I';
    }
    if(data.ward==='Private II'){
      valid=data.bed==='Private II';
    }
  }

  if(!valid){
    throw new Error('Ward, cubicle and bed do not match the approved layout.');
  }

  if(options.ward.indexOf(data.ward)<0){
    throw new Error('Ward is missing from Audit Lists.');
  }

  if(options.cubic.indexOf(data.cubic)<0){
    throw new Error('Cubicle is missing from Audit Lists.');
  }

  const approved=options.bed.some(function(b){
    return b.name===data.bed&&
      (!b.cubicle||b.cubicle===data.cubic);
  });

  if(!approved){
    throw new Error('Bed is not approved in Audit Lists.');
  }
}

function phoMobileListInfo_(key){
  return {
    ward:1,cubic:2,bed:3,
    ivf:5,errorCode:6,pharmacist:7
  }[key]||0;
}

function phoMobileReadOptions_(ss){
  const vals=ss.getSheetByName(PHO_MOBILE_CONFIG.lists)
    .getRange(2,1,PHO_MOBILE_CONFIG.listSize,8)
    .getDisplayValues();

  const opts={
    ward:[],cubic:[],bed:[],
    ivf:[],errorCode:[],pharmacist:[]
  };

  Object.keys(opts).forEach(function(key){
    const col=phoMobileListInfo_(key)-1;
    const seen={};

    vals.forEach(function(row){
      const name=phoMobileStr_(row[col]).trim();
      if(!name||name.indexOf('ADD_')===0)return;

      const cubicle=key==='bed'
        ?phoMobileStr_(row[7]).trim():'';

      const sig=(name+'\u0000'+cubicle).toLowerCase();
      if(seen[sig])return;

      seen[sig]=true;

      if(key==='bed'){
        opts.bed.push({name:name,cubicle:cubicle});
      }else{
        opts[key].push(name);
      }
    });
  });

  return opts;
}

function phoMobileInstallV3(){
  const lock=phoMobileLock_();
  lock.waitLock(25000);

  try{
    const ss=phoMobileSS_(false);
    const entry=ss.getSheetByName(PHO_MOBILE_CONFIG.entry);
    const archive=ss.getSheetByName(PHO_MOBILE_CONFIG.archive);
    const lists=ss.getSheetByName(PHO_MOBILE_CONFIG.lists);

    const checks=[
      [entry,'R7','Patient Name'],
      [entry,'S7','Name audit date'],
      [archive,'T1','Patient Name'],
      [lists,'G1','Clinical Pharmacist'],
      [lists,'H1','Bed cubicle (optional)']
    ];

    checks.forEach(function(c){
      const old=c[0].getRange(c[1]).getDisplayValue().trim();
      if(old&&old!==c[2]){
        throw new Error(
          'Setup stopped: '+c[0].getName()+'!'+c[1]+
          ' contains unexpected information.'
        );
      }
    });

    const oldNote=lists.getRange('A5').getDisplayValue();
    const notePrefix='Replace ADD_* placeholders';

    if(oldNote&&oldNote.indexOf(notePrefix)!==0){
      throw new Error(
        'Audit Lists A5 has custom information. Move it before V3 setup.'
      );
    }

    if(oldNote){
      lists.getRange('A5:F5').breakApart();
      lists.getRange('A5').clearContent();

      if(!lists.getRange('A154').getDisplayValue()){
        lists.getRange('A154').setValue(
          'Manage lists in the mobile app. Patient ID is numeric entry.'
        );
      }
    }

    checks.forEach(function(c){
      c[0].getRange(c[1]).setValue(c[2]);
    });

    entry.getRange('R7:S7')
      .setBackground('#24567B')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setWrap(true);

    entry.setColumnWidth(18,210);
    entry.setColumnWidth(19,110);
    entry.hideColumns(19);

    archive.getRange('T1')
      .setBackground('#17375B')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    archive.setColumnWidth(20,220);

    lists.getRange('G1:H1')
      .setBackground('#17375B')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setWrap(true);

    lists.setColumnWidth(7,190);
    lists.setColumnWidth(8,180);
    lists.getRange('D1').setValue(
      'Patient ID (numeric entry; no dropdown)'
    );

    entry.getRange('E8:E77').clearDataValidations();
    entry.getRange('E8:E77').setNumberFormat('@');
    archive.getRange('H2:H').setNumberFormat('@');

    SpreadsheetApp.flush();
    return {
      ok:true,
      entry:entry.getName(),
      archive:archive.getName()
    };
  }finally{
    lock.releaseLock();
  }
}

function phoMobileSignature_(v,date,pharmacist){
  const normalized=JSON.stringify({
    date:date,
    number:Number(v[0]),
    values:v.slice(1,13).map(function(x){
      return x===true||x===false?x:phoMobileStr_(x);
    }),
    status:phoMobileStr_(v[14]),
    id:phoMobileStr_(v[16]),
    name:phoMobileNameAuditDate_(v[18])===date

      ?phoMobileStr_(v[17]):'',
    nameDate:phoMobileStr_(v[18])
  });

  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    normalized,
    Utilities.Charset.UTF_8
  ).map(function(b){
    return ('0'+(b&255).toString(16)).slice(-2);
  }).join('');
}

function phoMobileRow_(v,date,pharmacist,recordedBy){
  const wasSaved=phoMobileStr_(v[14])==='Saved';

  return {
    number:Number(v[0]),
    ward:phoMobileStr_(v[1]),
    cubic:phoMobileStr_(v[2]),
    bed:phoMobileStr_(v[3]),
    patientId:phoMobileStr_(v[4]),
    ivf:phoMobileStr_(v[5]),
    patientName:phoMobileNameAuditDate_(v[18])===date
  ?phoMobileStr_(v[17]):'',

    iv:v[6]===true?'yes':(wasSaved?'no':''),
    chemo:v[7]===true?'yes':(wasSaved?'no':''),
    oral:v[8]===true?'yes':(wasSaved?'no':''),
    interaction:v[9]===true?'yes':(wasSaved?'no':''),
    error:v[10]===true?'yes':(wasSaved?'no':''),
    errorCode:phoMobileStr_(v[11]),
    details:phoMobileStr_(v[12]),
    status:phoMobileStr_(v[14]),
    savedAt:phoMobileStr_(v[15]),
    recordId:phoMobileStr_(v[16]),
    recordedBy:wasSaved?phoMobileStr_(recordedBy):'',
    signature:phoMobileSignature_(v,date,pharmacist)
  };
}

function phoMobileLoad_(){
  const ss=phoMobileSS_(true);
  const entry=ss.getSheetByName(PHO_MOBILE_CONFIG.entry);
  const date=entry.getRange('B3').getDisplayValue().trim();
  const pharmacist=entry.getRange('E3').getDisplayValue().trim();
  const rows=entry.getRange(8,1,70,19).getValues();

  const savedIds=new Set(
    rows.filter(function(r){
      return phoMobileStr_(r[14])==='Saved'&&!!r[16];
    }).map(function(r){
      return phoMobileStr_(r[16]);
    })
  );

  const recordedBy={};

  if(savedIds.size){
    const archive=ss.getSheetByName(PHO_MOBILE_CONFIG.archive);
    const last=archive.getLastRow();

    if(last>1){
      archive.getRange(2,1,last-1,3)
        .getDisplayValues()
        .forEach(function(r){
          if(savedIds.has(r[0])&&r[1]===date){
            recordedBy[r[0]]=r[2];
          }
        });
    }
  }

  return {
    date:date,
    today:phoMobileToday_(),
    pharmacist:pharmacist,
    options:phoMobileReadOptions_(ss),
    rows:rows.map(function(r){
      return phoMobileRow_(
        r,date,pharmacist,recordedBy[r[16]]||''
      );
    })
  };
}

function phoMobileBootstrap(){
  const data=phoMobileLoad_();

  if(data.date===data.today)return data;

  try{
    return phoMobileStartToday();
  }catch(error){
    console.warn(
      'PHO_AUTO_DATE_CHANGE_BLOCKED: '+
      (error&&error.message||error)
    );
    return phoMobileLoad_();
  }
}

function phoMobileChangePharmacist(payload){
  if(!payload||typeof payload!=='object'){
    throw new Error('Missing pharmacist handover request.');
  }

  const requestedDate=phoMobileClean_(
    payload.date,10,'Audit date'
  );
  const expected=phoMobileClean_(
    payload.expected,100,'Previous pharmacist'
  );
  const next=phoMobileClean_(
    payload.pharmacist,100,'New pharmacist'
  );

  if(!next){
    throw new Error('Select the incoming pharmacist.');
  }

  const lock=phoMobileLock_();
  lock.waitLock(25000);

  try{
    const ss=phoMobileSS_(true);
    const entry=ss.getSheetByName(PHO_MOBILE_CONFIG.entry);
    const activeDate=entry.getRange('B3').getDisplayValue().trim();
    const current=entry.getRange('E3').getDisplayValue().trim();

    if(activeDate!==requestedDate||
       activeDate!==phoMobileToday_()){
      throw new Error('Audit date changed. Refresh before handover.');
    }

    if(current!==expected){
      throw new Error(
        'Another pharmacist changed the active selection. Refresh.'
      );
    }

    if(!current){
      throw new Error(
        'Select the first pharmacist and save Patient 1 before handover.'
      );
    }

    if(phoMobileReadOptions_(ss).pharmacist.indexOf(next)<0){
      throw new Error(
        'Incoming pharmacist is not listed in Default Settings.'
      );
    }

    if(current===next){
      return {ok:true,pharmacist:current};
    }

    entry.getRange('E3').setValue(next);
    SpreadsheetApp.flush();

    return {ok:true,pharmacist:next};
  }finally{
    lock.releaseLock();
  }
}

function phoMobileHealthCheck(){
  const data=phoMobileLoad_();
  const counts={};

  Object.keys(data.options).forEach(function(k){
    counts[k]=data.options[k].length;
  });

  const result={
    ok:true,
    auditDate:data.date,
    patients:data.rows.length,
    saved:data.rows.filter(function(r){
      return r.status==='Saved';
    }).length,
    settingCounts:counts
  };

  console.log('PHO_MOBILE_HEALTH='+JSON.stringify(result));
  return result;
}

function phoMobileSettingsUpdate(payload){
  if(!payload||typeof payload!=='object'){
    throw new Error('Missing settings request.');
  }

  const key=phoMobileClean_(
    payload.key,20,'Category'
  );
  const col=phoMobileListInfo_(key);

  if(!col){
    throw new Error('Invalid settings category.');
  }

  const action=phoMobileClean_(
    payload.action,10,'Action'
  );

  if(['add','edit','delete'].indexOf(action)<0){
    throw new Error('Invalid settings action.');
  }

  const value=phoMobileClean_(
    payload.value,100,'Option'
  );
  const old=phoMobileClean_(
    payload.oldValue,100,'Previous option'
  );
  const cubic=key==='bed'
    ?phoMobileClean_(payload.cubicle,100,'Bed cubicle'):'';
  const oldCubic=key==='bed'
    ?phoMobileClean_(payload.oldCubicle,100,'Previous cubicle'):'';

  if(action!=='delete'&&!value){
    throw new Error('Enter a value first.');
  }

  const lock=phoMobileLock_();
  lock.waitLock(25000);

  try{
    const ss=phoMobileSS_(true);
    const sheet=ss.getSheetByName(PHO_MOBILE_CONFIG.lists);
    const options=phoMobileReadOptions_(ss);

    if(key==='bed'&&cubic&&
       options.cubic.indexOf(cubic)<0){
      throw new Error(
        'Create this cubicle in Default Settings first.'
      );
    }

    const source=sheet.getRange(
      2,col,PHO_MOBILE_CONFIG.listSize,1
    ).getDisplayValues().map(function(r){
      return r[0].trim();
    });

    const maps=key==='bed'
      ?sheet.getRange(2,8,PHO_MOBILE_CONFIG.listSize,1)
        .getDisplayValues().map(function(r){
          return r[0].trim();
        })
      :[];

    const isMatch=function(name,tag,a,b){
      return name.toLowerCase()===a.toLowerCase()&&
        (key!=='bed'||tag.toLowerCase()===b.toLowerCase());
    };

    const ix=source.findIndex(function(v,i){
      return isMatch(v,maps[i]||'',old,oldCubic);
    });

    if(action!=='add'&&ix<0){
      throw new Error(
        'This option changed elsewhere. Reload settings.'
      );
    }

    const duplicate=source.some(function(v,i){
      return action==='edit'&&i===ix
        ?false
        :isMatch(v,maps[i]||'',value,cubic);
    });

    if(action!=='delete'&&duplicate){
      throw new Error('This option already exists.');
    }

    if(action==='add'){
      const empty=source.findIndex(function(v){
        return !v||v.indexOf('ADD_')===0;
      });

      if(empty<0){
        throw new Error('This list is full (150 entries).');
      }

      sheet.getRange(empty+2,col).setValue(value);

      if(key==='bed'){
        sheet.getRange(empty+2,8).setValue(cubic);
      }
    }else if(action==='delete'){
      sheet.getRange(ix+2,col).clearContent();

      if(key==='bed'){
        sheet.getRange(ix+2,8).clearContent();
      }
    }else{
      sheet.getRange(ix+2,col).setValue(value);

      if(key==='bed'){
        sheet.getRange(ix+2,8).setValue(cubic);
      }
    }

    SpreadsheetApp.flush();

    return {
      ok:true,
      options:phoMobileReadOptions_(ss)
    };
  }finally{
    lock.releaseLock();
  }
}

function phoMobileSavePatient(payload){
  if(!payload||typeof payload!=='object'){
    throw new Error('Missing patient details.');
  }

  const n=Number(payload.number);

  if(!Number.isInteger(n)||n<1||n>70){
    throw new Error('Choose Patient 1–70.');
  }

  const signature=phoMobileClean_(
    payload.signature,64,'Version'
  );

  if(!/^[a-f0-9]{64}$/.test(signature)){
    throw new Error('This entry needs a refresh.');
  }

  const requestedDate=phoMobileClean_(
    payload.date,10,'Audit date'
  );

  const pharmacist=phoMobileClean_(
    payload.pharmacist,100,'Clinical Pharmacist'
  );

  const data={
    patientName:phoMobileClean_(
      payload.patientName,150,'Patient Name'
    ),
    patientId:phoMobileClean_(
      payload.patientId,50,'Patient ID'
    ),
    ward:phoMobileClean_(payload.ward,100,'Ward'),
    cubic:phoMobileClean_(payload.cubic,100,'Cubicle'),
    bed:phoMobileClean_(payload.bed,100,'Bed'),
    ivf:phoMobileClean_(payload.ivf,100,'IVF rate'),
    errorCode:phoMobileClean_(
      payload.errorCode,100,'Error code'
    ),
    details:phoMobileClean_(
      payload.details,1000,'Error details'
    )
  };

  const flags={};

  ['iv','chemo','oral','interaction','error']
    .forEach(function(k){
      const v=payload[k];

      if(v!=='yes'&&v!=='no'){
        throw new Error('Select YES or NO for '+k+'.');
      }

      flags[k]=v==='yes';
    });

  if(!pharmacist){
    throw new Error(
      'Select a Clinical Pharmacist on Patient 1.'
    );
  }

  if(!data.patientName||
     !/^[0-9]+$/.test(data.patientId)){
    throw new Error(
      'Enter Patient Name and numeric Patient ID.'
    );
  }

  if(!data.ward||!data.cubic||
     !data.bed||data.ivf===''){
    throw new Error(
      'Select Ward, its assigned bed, and the IVF rate.'
    );
  }

  if(
    !/^(?:\d{1,3})(?:\.\d{1,2})?$/.test(data.ivf)||
    Number(data.ivf)<0||
    Number(data.ivf)>200
  ){
    throw new Error(
      'IVF rate must be between 0 and 200 mL/hr.'
    );
  }

  if(flags.error&&(!data.errorCode||!data.details)){
    throw new Error(
      'Medication error: select error code and enter details.'
    );
  }

  if(!flags.error&&(data.errorCode||data.details)){
    throw new Error(
      'Clear error code/details when Medication Error = NO.'
    );
  }

  const lock=phoMobileLock_();
  lock.waitLock(25000);

  try{
    const ss=phoMobileSS_(true);
    const entry=ss.getSheetByName(PHO_MOBILE_CONFIG.entry);
    const archive=ss.getSheetByName(PHO_MOBILE_CONFIG.archive);
    const history=ss.getSheetByName(PHO_MOBILE_CONFIG.history);

    const date=entry.getRange('B3').getDisplayValue().trim();
    const fixedPharm=entry.getRange('E3').getDisplayValue().trim();

    if(
      date!==requestedDate||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)
    ){
      throw new Error('Audit date changed; reload the app.');
    }

    if(date!==phoMobileToday_()){
      throw new Error(
        'This is a previous-day audit. Resolve drafts before starting today.'
      );
    }

    if(fixedPharm&&fixedPharm!==pharmacist){
      throw new Error(
        'Active pharmacist changed to '+fixedPharm+
        '. Refresh or confirm handover.'
      );
    }

    const row=7+n;
    const existing=entry.getRange(
      row,1,1,19
    ).getValues()[0];

    if(Number(existing[0])!==n){
      throw new Error('Patient slot numbering changed.');
    }

    if(
      phoMobileSignature_(existing,date,fixedPharm)!==
      signature
    ){
      throw new Error(
        'Someone changed this patient row. Refresh before overwriting.'
      );
    }

    const opts=phoMobileReadOptions_(ss);

    if(
      opts.pharmacist.indexOf(pharmacist)<0&&
      pharmacist!==fixedPharm
    ){
      throw new Error(
        'Clinical Pharmacist is not in Default Settings.'
      );
    }

    phoMobileValidateLocation_(data,existing,opts);

    if(
      flags.error&&
      !(
        PHO_FIXED_ERRORS.indexOf(data.errorCode)>=0&&
        opts.errorCode.indexOf(data.errorCode)>=0
      )&&
      !(
        String(existing[11])===data.errorCode&&
        String(existing[14])==='Saved'
      )
    ){
      throw new Error(
        'Medication Error Code must be an approved category.'
      );
    }

    const ids=entry.getRange(
      8,5,70,1
    ).getDisplayValues();

    const statuses=entry.getRange(
      8,15,70,1
    ).getDisplayValues();

    ids.forEach(function(v,i){
      if(
        i!==n-1&&
        v[0]===data.patientId&&
        statuses[i][0]==='Saved'
      ){
        throw new Error(
          'Patient ID already saved in Patient '+(i+1)+'.'
        );
      }
    });

    const id=phoMobileStr_(existing[16])||
      Utilities.getUuid();

    const finder=archive.getLastRow()>1
      ?archive.getRange(
        2,1,archive.getLastRow()-1,1
      ).createTextFinder(id)
       .matchEntireCell(true)
       .findNext()
      :null;

    const old=finder
      ?archive.getRange(
        finder.getRow(),1,1,20
      ).getValues()[0]
      :null;

    const now=phoMobileNow_();
    const rev=old?Number(old[18]||0)+1:1;

    const originalPharmacist=old
      ?phoMobileStr_(old[2])||pharmacist
      :pharmacist;

    const out=[
      id,date,originalPharmacist,n,
      data.ward,data.cubic,data.bed,data.patientId,
      Number(data.ivf),
      flags.iv,flags.chemo,flags.oral,
      flags.interaction,flags.error,
      data.errorCode,data.details,
      old?old[16]:now,now,rev,data.patientName
    ];

    const unchanged=old&&
      old.slice(1,16).every(function(x,i){
        return String(x)===String(out[i+1]);
      })&&
      String(old[19]||'')===data.patientName;

    if(!unchanged){
      if(finder){
        archive.getRange(
          finder.getRow(),1,1,20
        ).setValues([out]);
      }else{
        archive.getRange(
          archive.getLastRow()+1,1,1,20
        ).setValues([out]);
      }

      history.appendRow([
        id,rev,now,old?'Updated':'Created',
        old?JSON.stringify({
          fields:old.slice(1,16),
          patientName:old[19]||''
        }):'',
        JSON.stringify({
          fields:out.slice(1,16),
          patientName:data.patientName,
          editedBy:pharmacist
        })
      ]);
    }

    if(!fixedPharm){
      entry.getRange('E3').setValue(pharmacist);
    }

    entry.getRange(row,2,1,12).setValues([[
      data.ward,
      data.cubic,
      data.bed,
      data.patientId,
      Number(data.ivf),
      flags.iv,
      flags.chemo,
      flags.oral,
      flags.interaction,
      flags.error,
      data.errorCode,
      data.details
    ]]);

    entry.getRange(row,14,1,6).setValues([[
      false,
      'Saved',
      unchanged?old[17]:now,
      id,
      data.patientName,
      date
    ]]);

    SpreadsheetApp.flush();

    const fresh=entry.getRange(
      row,1,1,19
    ).getValues()[0];

    return {
      ok:true,
      row:phoMobileRow_(
        fresh,date,pharmacist,originalPharmacist
      ),
      pharmacist:pharmacist
    };
  }finally{
    lock.releaseLock();
  }
}

function phoMobileStartToday(){
  const lock=phoMobileLock_();
  lock.waitLock(25000);

  try{
    const ss=phoMobileSS_(true);
    const entry=ss.getSheetByName(PHO_MOBILE_CONFIG.entry);
    const archive=ss.getSheetByName(PHO_MOBILE_CONFIG.archive);
    const today=phoMobileToday_();
    const date=entry.getRange('B3').getDisplayValue().trim();

    if(date===today){
      return phoMobileLoad_();
    }

    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today){
      throw new Error(
        'Audit date invalid or ahead of today. Manual review required.'
      );
    }

    const vals=entry.getRange(
      8,1,70,19
    ).getValues();

    vals.forEach(function(v,i){
      const status=phoMobileStr_(v[14]).trim();

      const draft=v.slice(1,13).some(function(x){
        return x!==''&&x!==null&&x!==false;
      });
      const pendingSave=v[13]===true;

      const pendingMetadata=!!(
        v[15]||v[16]||v[17]||v[18]
      );

      if(
        status!=='Saved'&&
        (draft||status||pendingSave||pendingMetadata)
      ){
        throw new Error(
          'Unsaved or modified data exists on Patient '+
          (i+1)+'. Resolve before starting a new day.'
        );
      }
    });

    const last=archive.getLastRow();
    const archived=last>1
      ?archive.getRange(
        2,1,last-1,4
      ).getDisplayValues()
      :[];

    const savedById=new Map();

    archived.forEach(function(r){
      if(r[0]){
        savedById.set(String(r[0]).trim(),r);
      }
    });

    vals.forEach(function(v,i){
      if(phoMobileStr_(v[14]).trim()!=='Saved'){
        return;
      }

      const id=phoMobileStr_(v[16]).trim();
      const stored=savedById.get(id);

      if(
        !id||!stored||
        stored[1]!==date||
        String(stored[3]).trim()!==String(i+1)
      ){
        throw new Error(
          'Archived record missing or mismatched for Patient '+
          (i+1)+'. New-day reset blocked.'
        );
      }
    });

    entry.getRange('B8:F77').clearContent();
    entry.getRange('G8:K77').setValue(false);
    entry.getRange('L8:M77').clearContent();
    entry.getRange('N8:N77').setValue(false);
    entry.getRange('O8:S77').clearContent();
    entry.getRange('E3').clearContent();

    entry.getRange('B3')
      .setNumberFormat('@')
      .setValue(today);

    const props=PropertiesService.getDocumentProperties();

    if(props){
      props.setProperty('PHO_ACTIVE_DATE',today);
    }

    SpreadsheetApp.flush();
    return phoMobileLoad_();
  }finally{
    lock.releaseLock();
  }
}

/**
 * SMART SUMMARY
 * Read-only calculations from saved Daily Checklist rows.
 * Does not return patient name or patient ID.
 */
function phoMobileSmartSummary(){
  const ss=phoMobileSS_(true);
  const sh=ss.getSheetByName(PHO_MOBILE_CONFIG.entry);
  const date=sh.getRange('B3').getDisplayValue().trim();

  const values=sh.getRange(
    PHO_MOBILE_CONFIG.first,
    1,
    PHO_MOBILE_CONFIG.count,
    PHO_MOBILE_CONFIG.cols
  ).getValues();

  const wards=[
    'PHO','BMT','Daycare',
    '4th Floor','Private I','Private II'
  ];

  const counts={};
  const categories={};

  wards.forEach(function(ward){
    counts[ward]={
      ward:ward,
      audited:0,
      errors:0,
      interactions:0
    };
  });

  PHO_FIXED_ERRORS.forEach(function(category){
    categories[category]=0;
  });

  const result={
    date:date,
    totalSlots:PHO_MOBILE_CONFIG.count,
    audited:0,
    pending:PHO_MOBILE_CONFIG.count,
    percent:0,
    iv:0,
    chemo:0,
    oral:0,
    interactions:0,
    errors:0,
    wards:[],
    categories:[],
    findings:[]
  };

  values.forEach(function(r){
    if(String(r[14]||'').trim()!=='Saved'){
      return;
    }

    result.audited++;

    let ward=String(r[1]||'').trim();
    if(ward==='PHO Ward')ward='PHO';
    if(ward==='BMT Ward')ward='BMT';

    if(!counts[ward]){
      counts[ward]={
        ward:ward||'Legacy ward',
        audited:0,
        errors:0,
        interactions:0
      };
    }

    counts[ward].audited++;

    if(r[6]===true)result.iv++;
    if(r[7]===true)result.chemo++;
    if(r[8]===true)result.oral++;

    if(r[9]===true){
      result.interactions++;
      counts[ward].interactions++;
    }

    if(r[10]===true){
      result.errors++;
      counts[ward].errors++;

      const category=
        String(r[11]||'').trim()||'Unspecified';

      if(!Object.prototype.hasOwnProperty.call(
        categories,category
      )){
        categories[category]=0;
      }

      categories[category]++;

      
result.findings.push({
  ward: ward,
  cubic: String(r[2] || '').trim(),
  bed: String(r[3] || '').trim(),
  patientName: String(r[17] || '').trim(),
  category: category,
  details: String(r[12] || '').trim()
});

    }
  });

  result.pending=result.totalSlots-result.audited;

  result.percent=Math.round(
    100*result.audited/result.totalSlots
  );

  result.wards=Object.keys(counts).map(function(w){
    return counts[w];
  });

  result.categories=Object.keys(categories).map(function(k){
    return {
      category:k,
      count:categories[k]
    };
  });

  return result;
}

/**
 * V5.3.2 — Patient Name Display Fix
 *
 * Converts a Google Sheets Date value or a text date
 * into the same yyyy-MM-dd format.
 *
 * READ ONLY — does not modify any spreadsheet cell.
 */
function phoMobileNameAuditDate_(value) {
  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      PHO_MOBILE_CONFIG.timezone,
      'yyyy-MM-dd'
    );
  }

  return phoMobileStr_(value).trim();
}

/**
 * PGICH PHO/BMT — Smart Summary History (2026-11-04)
 * READ ONLY. Historical periods are computed from Patient Records, not
 * from the daily 70-row checklist. No extra sheets, triggers or migrations.
 *
 * Public endpoint: phoMobileSmartSummaryHistory(period)
 * period: today | yesterday | two_days | three_days | month
 */
const PHO_HISTORY_PERIODS = Object.freeze({
  today: 'Today',
  yesterday: 'Yesterday',
  two_days: '2 Days Ago',
  three_days: '3 Days Ago',
  month: 'This Month'
});

function phoHistoryISODate_(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, PHO_MOBILE_CONFIG.timezone, 'yyyy-MM-dd');
  }
  const s = String(value === null || value === undefined ? '' : value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function phoHistoryOffsetDate_(iso, daysBack) {
  const p = String(iso).split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] - daysBack));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

function phoHistoryTrue_(v) {
  return v === true || String(v).trim().toLowerCase() === 'true';
}

function phoHistoryBase_(period, label, start, end, isMonth) {
  const wardNames = ['PHO', 'BMT', 'Daycare', '4th Floor', 'Private I', 'Private II'];
  const wards = {};
  const categories = {};
  wardNames.forEach(function(name) {
    wards[name] = {ward:name, audited:0, errors:0, interactions:0};
  });
  PHO_FIXED_ERRORS.forEach(function(name) {categories[name] = 0;});
  return {
    output: {
      period:period, periodLabel:label, date:isMonth ? start+' to '+end : start,
      startDate:start, endDate:end, isMonth:isMonth,
      totalSlots:isMonth ? null : PHO_MOBILE_CONFIG.count,
      audited:0, pending:isMonth ? null : PHO_MOBILE_CONFIG.count,
      percent:isMonth ? null : 0,
      iv:0, chemo:0, oral:0, interactions:0, errors:0,
      daysWithAudits:0, daysElapsed:null,
      wards:[], categories:[], findings:[], daily:[], note:''
    },
    wards:wards, categories:categories, dates:{}
  };
}

/**
 * Returns the same aggregate fields as phoMobileSmartSummary(), plus period,
 * periodLabel, isMonth and (for the month) a date-by-date breakdown.
 * The monthly response excludes patient names, bed details and findings.
 */
function phoMobileSmartSummaryHistory(period) {
  const selected = String(period || 'today');
  if (!Object.prototype.hasOwnProperty.call(PHO_HISTORY_PERIODS, selected)) {
    throw new Error('Unknown Smart Summary period. Refresh and try again.');
  }

  const today = phoMobileToday_(); // Existing Asia/Kolkata date function.
  if (selected === 'today') {
    const current = phoMobileSmartSummary();
    if (current.date !== today) {
      // A stale checklist is NOT today's report. Never mislabel its rows.
      const empty = phoHistoryBase_(selected, 'Today', today, today, false).output;
      empty.note = 'The active checklist is dated '+current.date+
        '. Today has no active checklist yet; historical reports remain available.';
      return empty;
    }
    current.period = 'today';
    current.periodLabel = 'Today';
    current.isMonth = false;
    current.startDate = today;
    current.endDate = today;
    current.daily = [];
    current.daysWithAudits = current.audited > 0 ? 1 : 0;
    current.note = '';
    return current;
  }

  const offset = selected === 'yesterday' ? 1 :
    selected === 'two_days' ? 2 : selected === 'three_days' ? 3 : 0;
  const isMonth = selected === 'month';
  const start = isMonth ? today.slice(0,7)+'-01' : phoHistoryOffsetDate_(today, offset);
  const end = isMonth ? today : start;
  const build = phoHistoryBase_(selected, PHO_HISTORY_PERIODS[selected], start, end, isMonth);
  const result = build.output;
  const ss = phoMobileSS_(true);
  const archive = ss.getSheetByName(PHO_MOBILE_CONFIG.archive);
  const last = archive.getLastRow();

  if (last > 1) {
    // Read only the date column first; avoids loading years of patient data.
    const dateValues = archive.getRange(2, 2, last - 1, 1).getValues();
    const matchingRows = [];
    dateValues.forEach(function(row, index) {
      const date = phoHistoryISODate_(row[0]);
      if (date && date >= start && date <= end) matchingRows.push(index+2);
    });

    // Fetch only matching stretches. Small gaps may be included to reduce
    // Spreadsheet calls, but nonmatching dates are always filtered out.
    const spans = [];
    matchingRows.forEach(function(number) {
      const lastSpan = spans.length ? spans[spans.length-1] : null;
      if (lastSpan && number <= lastSpan.end + 6 && number - lastSpan.start < 400) {
        lastSpan.end = number;
      } else {
        spans.push({start:number, end:number});
      }
    });

    const matches = new Set(matchingRows);
    const unique = new Map();
    spans.forEach(function(span) {
      const rows = archive.getRange(span.start, 1, span.end-span.start+1, 20).getValues();
      rows.forEach(function(row, index) {
        const sheetRow = span.start+index;
        if (!matches.has(sheetRow)) return;
        const date = phoHistoryISODate_(row[1]);
        if (date < start || date > end) return;
        const recordId = String(row[0] || '').trim();
        const key = recordId ? date+'|'+recordId : 'sheet-row|'+sheetRow;
        const old = unique.get(key);
        // A legacy duplicated Record ID must never inflate counts.
        if (!old || Number(row[18] || 0) >= Number(old[18] || 0)) {
          unique.set(key,row);
        }
      });
    });

    unique.forEach(function(row) {
      const date = phoHistoryISODate_(row[1]);
      let ward = String(row[4] || '').trim();
      if (ward === 'PHO Ward') ward='PHO';
      if (ward === 'BMT Ward') ward='BMT';
      const wardKey = ward || 'Legacy ward';
      if (!build.wards[wardKey]) {
        build.wards[wardKey] = {
          ward:wardKey, audited:0, errors:0, interactions:0
        };
      }
      const wardStats = build.wards[wardKey];
      if (!build.dates[date]) {
        build.dates[date] = {date:date, audited:0, errors:0, interactions:0};
      }
      const daily = build.dates[date];
      result.audited++;
      wardStats.audited++;
      daily.audited++;
      if (phoHistoryTrue_(row[9])) result.iv++;
      if (phoHistoryTrue_(row[10])) result.chemo++;
      if (phoHistoryTrue_(row[11])) result.oral++;
      if (phoHistoryTrue_(row[12])) {
        result.interactions++;
        wardStats.interactions++;
        daily.interactions++;
      }
      if (phoHistoryTrue_(row[13])) {
        result.errors++;
        wardStats.errors++;
        daily.errors++;
        const category=String(row[14] || '').trim() || 'Unspecified';
        if (!Object.prototype.hasOwnProperty.call(build.categories,category)) {
          build.categories[category]=0;
        }
        build.categories[category]++;
        if (!isMonth) {
          // This historical-day detail is intended for authorized clinical staff.
          result.findings.push({
            ward:wardKey,
            cubic:String(row[5] || '').trim(),
            bed:String(row[6] || '').trim(),
            patientName:String(row[19] || '').trim(),
            category:category,
            details:String(row[15] || '').trim()
          });
        }
      }
    });
  }

  result.wards = Object.keys(build.wards).map(function(k) {return build.wards[k];});
  result.categories = Object.keys(build.categories).map(function(k) {
    return {category:k, count:build.categories[k]};
  });
  result.daysWithAudits = Object.keys(build.dates).filter(function(k) {
    return build.dates[k].audited > 0;
  }).length;

  if (isMonth) {
    const allDays=[];
    let date=end;
    while (date >= start) {
      allDays.push(build.dates[date] || {
        date:date, audited:0, errors:0, interactions:0
      });
      date = phoHistoryOffsetDate_(date,1);
    }
    result.daily=allDays;
    result.daysElapsed=allDays.length;
    result.note='Month-to-date totals count saved audits. No 70-per-day pending target is assumed for non-audit days.';
  } else {
    result.pending=Math.max(0, PHO_MOBILE_CONFIG.count-result.audited);
    result.percent=Math.min(100,Math.round(
      100*result.audited/PHO_MOBILE_CONFIG.count
    ));
    result.note=result.audited===0 ?
      'No saved patient audits found for this date. This does not confirm whether an audit session was scheduled.' : '';
  }
  return result;
}