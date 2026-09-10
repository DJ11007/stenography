begin;

-- Rajasthan LDC Hindi chapters were uploaded with a handful of wrong-key
-- typos baked into the stored Kruti Dev passage: "मॉड्यूल" as मॉडयुल,
-- "अपनी" as अचनी, "मापी" as माची, a missing क in भूकंपीय, stray commas ...
-- No decoder can guess those, so a student who types the correct word is
-- graded against the typo. Each block below replaces the passage with the
-- corrected, keyboard-typeable Kruti Dev text (produced by unicodeToKrutiDev
-- + the token repairs, verified to round-trip) in a NEW immutable version,
-- exactly like 202608230009. Existing attempts keep their frozen scores.
-- Guarded per chapter: a slug that is missing, not Kruti Dev, or already
-- corrected is skipped with a notice, never a failed deploy. Chapter 8
-- needed no correction and is not touched.

do $ch1$
declare
  v public.test_versions%rowtype;
  next_num integer;
  new_id uuid;
  corrected constant text := 'f''k{kk euq"; ds thou eas Kku] vkRefo''okl vkSj foosd dk fodkl djrh gSA bldk mís''; dsoy ijh{kk eas vPNs vad izkIr djuk ;k jkstxkj gkfly djuk ugha gksrk] cfYd O;fDr dks ftEesnkj ukxfjd cukuk Hkh gksrk gSA f''kf{kr O;fDr lgh vkSj xyr ds chp varj le> ldrk gS rFkk dfBu ifjfLFkfr;kas eas lksp&le>dj fu.kZ; ys ldrk gSA f''k{kk ds ek/;e ls lekt eas QSyh xjhch] vlekurk] va/kfo''okl vkSj vf''k{kk tSlh leL;kvksa dks de fd;k tk ldrk gSA blfy, izR;sd cPps dks xq.koRrkiw.kZ f''k{kk izkIr djus dk leku volj feyuk pkfg,A ifjokj] fo|ky; vkSj lekt dh ftEesnkjh gS fd os fo|kfFkZ;kas dks lh[kus ds fy, lqjf{kr rFkk ldkjkRed okrkoj.k iznku djasA

fo|ky; fo|kFkhZ ds thou dk egÙoiw.kZ Hkkx gksrk gSA ;g¡k og fofHké fo"k;kas dk Kku izkIr djus ds lkFk vuq''kklu] lg;ksx] bZekunkjh vkSj le; dh ikcanh Hkh lh[krk gSA f''k{kd cPpkas dks dsoy iqLrd dk ikB ugha i<+krs] cfYd mudh #fp;kas vkSj {kerkvksa dks igpkuus eas lgk;rk Hkh djrs gSaA ,d vPNk f''k{kd dfBu fo"k; dks ljy mnkgj.kkas ds ek/;e ls le>krk gS vkSj fo|kfFkZ;kas dks iz''u iwNus ds fy, izksRlkfgr djrk gSA iz''u iwNuk detksjh dk ugha] cfYd ftKklk vkSj lh[kus dh bPNk dk ladsr gksrk gSA tks fo|kFkhZ fcuk ladksp viuh leL;k crkrs gSa] os viuh xyfr;kas dks tYnh le>dj csgrj izn''kZu dj ldrs gSaA

le; izR;sd O;fDr ds fy, cgqr ewY;oku gksrk gSA chrk gqvk le; fdlh Hkh dher ij okil ugha yk;k tk ldrkA blfy, geas vius nSfud dk;kasZ dh ;kstuk igys ls rS;kj djuh pkfg,A fo|kFkhZ lqcg mBus ls ysdj jkr dks lksus rd ds dk;kasZ dh ,d O;kogkfjd le;&lkj.kh cuk ldrs gSaA bleas i<+kbZ] [ksy] Hkkstu] foJke vkSj euksjatu ds fy, i;kZIr le; gksuk pkfg,A cgqr dBksj le;&lkj.kh cukuk Hkh mfpr ugha gS] D;kasfd mldk fu;fer ikyu dfBu gks ldrk gSA ;kstuk ,slh gksuh pkfg, ftls ifjfLFkfr;kas ds vuqlkj FkksM+k cnyk tk ldsA lcls vko'';d dke dks igys iwjk djus dh vknr le; izca/ku dks vklku cukrh gSA

LokLF; dks vPNk cuk, j[kuk Hkh fo|kFkhZ dh izxfr ds fy, vko'';d gSA LoLFk ''kjhj eas gh lfdz; vkSj izlé eu dk fodkl gksrk gSA ikSf"Vd Hkkstu] fu;fer O;k;ke vkSj i;kZIr uhan ls ''kjhj dks ÅtkZ feyrh gSA fo|kfFkZ;kas dks rkts Qy] gjh lfCt;¡k] nkyas vkSj ?kj dk cuk larqfyr Hkkstu ysuk pkfg,A vf/kd rsy] ued rFkk phuh okys [kk| inkFkkasZ dk lsou lhfer djuk pkfg,A lqcg dh lSj] ;ksx ;k gYdk O;k;ke ''kjhj dks pqLr j[krk gS vkSj ,dkxzrk c<+krk gSA nsj jkr rd eksckby Qksu pykus ls uhan izHkkfor gksrh gS] ftlds dkj.k vxys fnu Fkdku rFkk vkyL; eglwl gks ldrk gSA

foKku vkSj izkS|ksfxdh us f''k{kk ds {ks= eas vusd ifjorZu fd, gSaA vkt fo|kFkhZ baVjusV dh lgk;rk ls fofHké fo"k;kas dh tkudkjh dqN gh {k.kkas eas izkIr dj ldrs gSaA v‚uykbu d{kk,¡] fMftVy iqLrdas vkSj ''kS{kf.kd ohfM;ks i<+kbZ dks vf/kd jkspd cuk jgs gSaA daI;wVj dk Kku fo|kfFkZ;kas dks Hkfo"; dh pqukSfr;kas ds fy, rS;kj djrk gSA gkykafd] rduhd dk mi;ksx lko/kkuh vkSj ftEesnkjh ds lkFk fd;k tkuk pkfg,A baVjusV ij miyC/k izR;sd tkudkjh lgh ugha gksrh] blfy, fo''oluh; Ljksrkas dh igpku vko'';d gSA O;fDrxr tkudkjh] ikloMZ vkSj egÙoiw.kZ nLrkost vutku yksxkas ds lkFk lk>k ugha djus pkfg,A rduhd gekjh lgk;d gS] ijarq mldk vR;f/kd mi;ksx le; vkSj LokLF; dks uqdlku igq¡pk ldrk gSA

i;kZoj.k dh lqj{kk Hkh izR;sd ukxfjd dk drZO; gSA LoPN gok] ''kq) ikuh] mitkÅ Hkwfe vkSj gjs&Hkjs ou gekjs vfLrRo ds fy, vko'';d gSaA tula[;k o`f)] iznw"k.k vkSj izkd`frd lalk/kukas ds vR;f/kd mi;ksx ds dkj.k i;kZoj.k dk larqyu fcxM+ jgk gSA IykfLVd dk vuko'';d iz;ksx ufn;kas] [ksrkas vkSj leqnzkas dks iznwf"kr djrk gSA geas diM+s ;k dkxt ds FkSykas dk mi;ksx djuk pkfg, rFkk dpjs dks fu/kkZfjr LFkku ij Mkyuk pkfg,A fctyh vkSj ikuh dh cpr djus tSls NksVs iz;kl Hkh i;kZoj.k laj{k.k eas cM+k ;ksxnku ns ldrs gSaA izR;sd O;fDr dks o"kZ eas de ls de ,d ikS/kk yxkdj mldh fu;fer ns[kHkky djuh pkfg,A

thou eas lQyrk izkIr djus ds fy, ldkjkRed –f"Vdks.k cuk, j[kuk vko'';d gSA vlQyrk fdlh ;k=k dk var ugha gksrh] cfYd og geas viuh dfe;kas dks le>us dk volj nsrh gSA dHkh&dHkh iwjh esgur djus ds ckn Hkh eupkgk ifj.kke izkIr ugha gksrkA ,slh fLFkfr eas fujk''k gksdj iz;kl NksM+ nsuk mfpr ugha gSA O;fDr dks viuh rS;kjh dh leh{kk djuh pkfg,] vuqHkoh yksxkas ls ekxZn''kZu ysuk pkfg, vkSj ubZ ;kstuk ds lkFk nksckjk iz;kl djuk pkfg,A egku miyfC/k;¡k lkekU;r% yacs la?k"kZ] /kS;Z vkSj vusd NksVs iz;klkas dk ifj.kke gksrh gSaA vkRefo''okl dk vFkZ ;g ugha gS fd O;fDr dHkh xyrh ugha djsxk] cfYd ;g fo''okl gS fd og viuh xyfr;kas ls lh[kdj vkxs c<+ ldrk gSA

fo|kfFkZ;kas dks vius thou eas Li"V y{; fu/kkZfjr djuk pkfg,A y{; ,slk gksuk pkfg, tks mudh #fp] ;ksX;rk vkSj ifjfLFkfr;kas ds vuqdwy gksA cM+s y{; dks NksVs dk;kasZ eas c¡kVus ls mls izkIr djuk vklku gks tkrk gSA izfrfnu fd;k x;k FkksM+k&lk vH;kl Hkh yacs le; eas izHkko''kkyh ifj.kke nsrk gSA nwljkas dh lQyrk ls tyu j[kus ds ctk; muls izsj.kk ysuh pkfg,A fouEjrk] esgur] bZekunkjh vkSj lg;ksx dh Hkkouk O;fDr ds pfj= dks etcwr cukrh gSA Kku rHkh lkFkZd gksrk gS tc mldk mi;ksx lekt dh HkykbZ ds fy, fd;k tk,A tks fo|kFkhZ vuq''kklu ds lkFk lh[krs gSa vkSj dfBukb;kas eas Hkh viuk iz;kl tkjh j[krs gSa] os Hkfo"; eas ftEesnkj] l{ke vkSj lQy ukxfjd curs gSaA';
begin
  select ver.* into v
  from public.test_versions ver
  join public.tests t on t.current_version_id = ver.id
  where t.slug = 'izfrys-ku-1'
  for update of ver;

  if found and v.input_system_id = 'hindi-krutidev-010' and v.passage <> corrected then
    select coalesce(max(version_number), 0) + 1 into next_num
    from public.test_versions where test_id = v.test_id;

    insert into public.test_versions(
      test_id, version_number, title, description, language, mode, input_system_id, duration_seconds,
      passage, required_wpm, required_accuracy, backspace_mode, word_method, highlight_mode,
      visibility, passage_characters, passage_words, configuration, created_by
    ) values (
      v.test_id, next_num, v.title, v.description, v.language, v.mode, v.input_system_id, v.duration_seconds,
      corrected, v.required_wpm, v.required_accuracy, v.backspace_mode, v.word_method, v.highlight_mode,
      v.visibility, char_length(corrected),
      coalesce(array_length(regexp_split_to_array(btrim(corrected), '\s+'), 1), 0),
      coalesce(v.configuration, '{}'::jsonb) || jsonb_build_object(
        'passage_encoding', 'krutidev-legacy',
        'repair_reason', 'hand-typed wrong-key typos corrected (Chapter 1)'
      ),
      v.created_by
    ) returning id into new_id;

    update public.tests
    set current_version_id = new_id, current_version_number = next_num, updated_at = now()
    where id = v.test_id;

    if v.created_by is not null then
      insert into public.admin_test_audit_log(actor_user_id, test_id, test_version_id, action, metadata)
      values (v.created_by, v.test_id, new_id, 'test_version_created',
        jsonb_build_object('version', next_num, 'repair_reason', 'krutidev typo correction', 'historical_version_preserved', true));
    end if;

    raise notice 'krutidev chapter repair: izfrys-ku-1 -> version %', next_num;
  else
    raise notice 'krutidev chapter repair: izfrys-ku-1 skipped (found=%, input_system=%)', found, coalesce(v.input_system_id, '-');
  end if;
end $ch1$;

do $ch2$
declare
  v public.test_versions%rowtype;
  next_num integer;
  new_id uuid;
  corrected constant text := '>¡klh dh jkuh y{ehckbZ Hkkjrh; bfrgkl dh ohjkaxuk ekuh tkrh gSA mudk thou lkgl] LokfHkeku vkSj ns''kHkfDr dh vuqie dgkuh izLrqr djrkA mudk tUe okjk.klh eas méhl uoacj vBkjg lkS vëkbZl gqvkA cpiu eas ifjokj mUgas izseiwoZd euq uke ls cqykrk FkkA muds firk eksjksiar rkacs fo}ku vkSj LokfHkekuh O;fDr ekus tkrsA mudh ekrk HkkxhjFkhckbZ /kkfeZd fopkjkas okyh laLdkjh efgyk FkhaA euq us cpiu eas viuh ekrk dks vle; [kks fn;kA blds ckn firk mUgas fcBwj fLFkr is''kok njckj yk, FksA ;g¡k euq us ?kqM+lokjh] ryokjckth vkSj rhjankth dk izf''k{k.k ik;kA og ukuk lkgc vkSj rkR;k Vksis lax vH;kl djrh FkhaA mudk fuHkhZd LoHkko cpiu ls lcdks cgqr izHkkfor djrk FkkA mUgkasus ijaijkxr lhekvksa dks lkgliwoZd pqukSrh nsdj igpku cukbZ FkhA euq dk fookg >¡klh ujs''k xaxk/kj jko ds lkFk gqvkA fookg i''pkr mudk uke cnydj y{ehckbZ j[kk x;k Fkk rcA jkuh us jktdk;Z] iz''kklu vkSj tudY;k.k dks xaHkhjrk ls le>kA mudh fouEjrk vkSj U;k;fiz;rk ls turk dk fo''okl yxkrkj c<+kA jktifjokj us ,d iq= ik;k] fdarq mldk ''kh?j fu/ku gqvkA bl nq[kn ?kVuk us jktk vkSj jkuh dks vR;ar O;fFkr fd;kA ckn eas naifr us nkeksnj jko dks mRrjkf/kdkjh cuk;k FkkA jktk xaxk/kj jko dk LokLF; fujarj detksj gksrk x;k FkkA uoacj vBkjg lkS frjiu eas mudk nq[kn fu/ku gks x;kA blds ckn jkT; dh ftEesnkjh jkuh ds da/kkas ij vkbZA fCjfV''k ljdkj us nRrd mRrjkf/kdkjh dks ekU;rk nsus ls badkj fd;kA mudh gM+i uhfr >¡klh jkT; ds fy, ladV cuh FkhA xouZj MygkSth us >¡klh dks vaxzsth ''kklu eas feykuk pkgkA jkuh us bl vU;k;iw.kZ fu.kZ; dk dM+k fojks/k fd;k FkkA mUgkasus viuk jkT; NksM+us ls Li"V :i ls badkj fd;k FkkA mudk izfl) ladYi turk ds Hkhrj lkgl txkrk jgk FkkA jkuh us iz''kklu etcwr djds lsuk dk iquxZBu vkjaHk fd;k FkkA efgykvksa dks Hkh ;q) laca/kh izf''k{k.k fu;fer :i ls feykA
vBkjg lkS lRrkou eas O;kid lSfud fonzksg vkjaHk gqvk FkkA bl vkanksyu us ''kh?j gh tudzkafr dk Lo:i xzg.k fd;kA >¡klh eas Hkh jktuhfrd vfLFkjrk vkSj lSU; la?k"kZ c<+k FkkA jkuh us dfBu ifjfLFkfr eas jkT; dh O;oLFkk laHkkyh FkhA mUgkasus ukxfjd lqj{kk vkSj vko'';d vkiwfrZ ij fo''ks"k /;ku fn;kA mudh usr`Ro {kerk us lSfudkas dk eukscy vR;f/kd c<+k;k FkkA
vaxzsth lsuk us ekpZ vBkjg lkS vëkou eas >¡klh ?ksjkA fdys ij rksikas ls yxkrkj Hkkjh izgkj fd, x, FksA jkuh ds lSfudkas us lhfer lk/kukas ls izfrjks/k tkjh j[kkA efgykvksa us xksyk ck:n igq¡pkdj j{kk dk;kasZ eas lg;ksx fn;kA >ydkjh ckbZ tSlh ohjkaxukvksa us vlk/kkj.k lkgl fn[kk;k FkkA dbZ fnukas rd >¡klh dk fdyk etcwrh ls MVk jgkA
varr% vaxzsth lsuk us uxj ds Hkhrj izos''k dj fy;kA jkuh vius nRrd iq= lfgr lqjf{kr fdys ls fudyha FkhaA mUgkasus dkyih igq¡pdj rkR;k Vksis ls lSU; lg;ksx fy;kA la;qDr lsukvksa us vaxzstkas ds fo#) la?k"kZ tkjh j[kk FkkA dkyih eas ijkt; feyh] ysfdu mudk ladYi detksj ugha iM+kA dzkafrdkjh lSfud ckn eas Xokfy;j dh fn''kk eas c<+s FksA
Xokfy;j igq¡pdj dzkafrdkfj;kas us egRoiw.kZ fdys ij vf/kdkj fd;kA jkuh us vkxkeh la?k"kZ ds fy, rqjar rS;kjh vkjaHk dhA vaxzsth lsuk,¡ ''kh?j Xokfy;j ds fudV igq¡p pqdh FkhaA jkuh us lSfud os''k igudj ;q) dk usr`Ro fd;k FkkA vBkjg twu vBkjg lkS vëkou dks Hkh"k.k ;q) gqvkA ;q)Hkwfe eas yM+rs gq, jkuh xaHkhj :i ls ?kk;y gqb±A
mudk egku cfynku Hkkjrh; Lora=rk la?k"kZ dk LFkk;h izsj.kkL=ksr cu x;kA vaxzst vf/kdkfj;kas us Hkh mudh ohjrk dks Lohdkj fd;k FkkA yksdxhrkas vkSj dforkvksa us mudk ;''k ns''kHkj eas QSyk;k FkkA ml izfl) dfork us mudh Le`fr lnSo vej cukbZ FkhA vkt y{ehckbZ lkgl] usr`Ro vkSj vkRelEeku dh izrhd gSaA mudk thou fo|kfFkZ;kas dks dfBukb;kas ls la?k"kZ djuk fl[kkrk gSA';
begin
  select ver.* into v
  from public.test_versions ver
  join public.tests t on t.current_version_id = ver.id
  where t.slug = 'chapter-2'
  for update of ver;

  if found and v.input_system_id = 'hindi-krutidev-010' and v.passage <> corrected then
    select coalesce(max(version_number), 0) + 1 into next_num
    from public.test_versions where test_id = v.test_id;

    insert into public.test_versions(
      test_id, version_number, title, description, language, mode, input_system_id, duration_seconds,
      passage, required_wpm, required_accuracy, backspace_mode, word_method, highlight_mode,
      visibility, passage_characters, passage_words, configuration, created_by
    ) values (
      v.test_id, next_num, v.title, v.description, v.language, v.mode, v.input_system_id, v.duration_seconds,
      corrected, v.required_wpm, v.required_accuracy, v.backspace_mode, v.word_method, v.highlight_mode,
      v.visibility, char_length(corrected),
      coalesce(array_length(regexp_split_to_array(btrim(corrected), '\s+'), 1), 0),
      coalesce(v.configuration, '{}'::jsonb) || jsonb_build_object(
        'passage_encoding', 'krutidev-legacy',
        'repair_reason', 'hand-typed wrong-key typos corrected (Chapter 2)'
      ),
      v.created_by
    ) returning id into new_id;

    update public.tests
    set current_version_id = new_id, current_version_number = next_num, updated_at = now()
    where id = v.test_id;

    if v.created_by is not null then
      insert into public.admin_test_audit_log(actor_user_id, test_id, test_version_id, action, metadata)
      values (v.created_by, v.test_id, new_id, 'test_version_created',
        jsonb_build_object('version', next_num, 'repair_reason', 'krutidev typo correction', 'historical_version_preserved', true));
    end if;

    raise notice 'krutidev chapter repair: chapter-2 -> version %', next_num;
  else
    raise notice 'krutidev chapter repair: chapter-2 skipped (found=%, input_system=%)', found, coalesce(v.input_system_id, '-');
  end if;
end $ch2$;

do $ch3$
declare
  v public.test_versions%rowtype;
  next_num integer;
  new_id uuid;
  corrected constant text := 'panz;ku rhu Hkkjr dk egRoiw.kZ vkSj lQy panz vfHk;ku FkkA bl vfHk;ku us Hkkjrh; varfj{k foKku dks ubZ igpku nhA Hkkjrh; varfj{k vuqla/kku laxBu us bldk Lons''kh fodkl fd;k FkkA ;g vfHk;ku panz;ku nks ds ckn rS;kj fd;k x;k FkkA oSKkfudkas us fiNyh pqukSfr;kas ls vusd mi;ksxh vuqHko izkIr fd,A mu vuqHkokas us u, vfHk;ku dh lQyrk dk ekxZ cuk;kA panz;ku rhu ds rhu izeq[k Hkkx fu/kkZfjr fd, x, FksA bueas iz.kksnu e‚M~;wy] fodze ySaMj vkSj izKku jksoj ''kkfey FksA iz.kksnu e‚M~;wy us ySaMj dks panz d{kk rd igq¡pk;k FkkA fodze ySaMj dks lqjf{kr lrg ij /khjs mrjuk Fkk rcA izKku jksoj dks mrjdj panz feV~Vh dk v/;;u djuk FkkA lHkh Hkkx Hkkjrh; oSKkfudkas vkSj vfHk;arkvksa }kjk fodflr gq, FksA vfHk;ku dk iz{ksi.k 14 tqykbZ nks gtkj rsbZl gqvk FkkA ,yoh,e rhu j‚dsV us ;ku dks lQyrkiwoZd varfj{k eas igq¡pk;kA iz{ksi.k JhgfjdksVk fLFkr izfl) lrh''k /kou dasnz ls fd;k x;kA j‚dsV us ;ku dks fu/kkZfjr izkjafHkd d{kk eas LFkkfir fd;kA blds ckn i`Foh ds pkjkas vksj d{kk,¡ c<+kbZ xb± FkhaA varr% ;ku us panzek dh fn''kk eas ;k=k izkjaHk dhA panz d{kk eas igq¡pdj xfr vkSj nwjh fu;af=r gqbZ FkhaA iz.kksnu e‚M~;wy ls fodze ySaMj iw.kZr% lQyrkiwoZd vyx gqvk FkkA ySaMj us viuh panz d{kk /khjs&/khjs de djuk ''kq: fd;kA izR;sd izfdz;k dk lQy fu;a=.k casxyq# fLFkr dasnz ls gqvkA oSKkfud yxkrkj ;ku ls feyus okys ladsrkas dk v/;;u djrsA lVhd x.kuk vkSj lko/kkuh bl pj.k eas vR;ar vko'';d FkhaA rsbZl vxLr nks gtkj rsbZl dk fnu vR;ar ,sfrgkfld cukA fodze us panz lrg ij lQy lqjf{kr uje vorj.k fd;kA ;g miyfC/k panz nf{k.kh {ks= ds fudV gkfly gqbZ FkhA Hkkjr panzek ij lQyrkiwoZd mrjus okyk prqFkZ ns''k cuk FkkA nf{k.kh /#oh; {ks= ds fudV mrjus okyk Hkkjr izFke cukA ns''kHkj eas ukxfjdkas us bl lQyrk dk mRlo euk;k FkkA vorj.k ds ckn izKku jksoj /khjs ls ckgj fudyk FkkA jksoj us panz lrg ij yxHkx ,d lkS ehVj pydj fn[kk;kA mlus vklikl dh panz feV~Vh vkSj pV~Vkukas dk ijh{k.k fd;kA jksoj ij nks fo''ks"k mi;ksxh oSKkfud midj.k yxk, x, FksA bu midj.kkas us rRokas dh mifLFkfr laca/kh tkudkjh ,d= dhA iz;ksxkas us panz lrg dh lajpuk le>us eas lgk;rk dhA fodze ySaMj ij Hkh dbZ egRoiw.kZ oSKkfud midj.k ekStwn FksA pkLVs midj.k us lrg ds rkieku dk v/;;u fd;k FkkA bYlk midj.k us LFkkuh; daiu vkSj Hkwdaih; xfrfof/k ekih FkhaA jaHkk midj.k us lrg fudV IykTek okrkoj.k dh t¡kp dhA uklk dk fLFkj ijkorZd Hkh ySaMj ij yxk;k x;k FkkA bu iz;ksxkas ls Hkfo"; ds vuqla/kku dks mi;ksxh vk/kkj feykA vfHk;ku dk fu;ksftr thou dsoy yxHkx ,d panz fnol FkkA ,d panz fnol yxHkx 14 i`Foh fnukas ds cjkcj gksrkA bl vof/k eas ySaMj vkSj jksoj us dk;Z iwjs fd,A lw;Zizdk''k ls nksukas midj.kkas dks yxkrkj vko'';d ÅtkZ feyrh FkhA panz jkf= vkus ij rkieku vR;ar de gks x;k FkkA blds ckn ySaMj vkSj jksoj vkxs lqIr voLFkk eas jgsA vorj.k LFky dks izfl) f''ko ''kfDr fcanq uke fn;k x;kA Hkkjr us rsbZl vxLr dks jk"Vzh; varfj{k fnol ?kksf"kr fd;kA ;g fnol oSKkfud miyfC/k;kas vkSj ;qok izfrHkkvksa dks lefiZr gSA vfHk;ku us fo|kfFkZ;kas eas varfj{k foKku dh #fp dkQh c<+kbZA mlus vuqla/kku] xf.kr vkSj vfHk;kaf=dh dk egRo Li"V le>k;k FkkA VheodZ vkSj /kS;Z us bl tfVy vfHk;ku dks lQy cuk;kA panz;ku rhu us lQy lqjf{kr vorj.k dh rduhd iznf''kZr dhA mlus panz lrg ij dq''ky jksoj lapkyu Hkh lQyrkiwoZd fn[kk;kA oSKkfud iz;ksxkas us Hkkjr dh vuqla/kku {kerk vkSj etcwr cukbZA vfHk;ku dh lQyrk us oSf''od Lrj ij lEeku c<+k;kA bl miyfC/k us Hkfo"; ds panz vfHk;kukas dks izsj.kk nhA fo|kFkhZ blls ifjJe] uokpkj vkSj vlQyrk ls lh[kuk le>rs gSaA';
begin
  select ver.* into v
  from public.test_versions ver
  join public.tests t on t.current_version_id = ver.id
  where t.slug = 'chapter-3'
  for update of ver;

  if found and v.input_system_id = 'hindi-krutidev-010' and v.passage <> corrected then
    select coalesce(max(version_number), 0) + 1 into next_num
    from public.test_versions where test_id = v.test_id;

    insert into public.test_versions(
      test_id, version_number, title, description, language, mode, input_system_id, duration_seconds,
      passage, required_wpm, required_accuracy, backspace_mode, word_method, highlight_mode,
      visibility, passage_characters, passage_words, configuration, created_by
    ) values (
      v.test_id, next_num, v.title, v.description, v.language, v.mode, v.input_system_id, v.duration_seconds,
      corrected, v.required_wpm, v.required_accuracy, v.backspace_mode, v.word_method, v.highlight_mode,
      v.visibility, char_length(corrected),
      coalesce(array_length(regexp_split_to_array(btrim(corrected), '\s+'), 1), 0),
      coalesce(v.configuration, '{}'::jsonb) || jsonb_build_object(
        'passage_encoding', 'krutidev-legacy',
        'repair_reason', 'hand-typed wrong-key typos corrected (Chapter 3)'
      ),
      v.created_by
    ) returning id into new_id;

    update public.tests
    set current_version_id = new_id, current_version_number = next_num, updated_at = now()
    where id = v.test_id;

    if v.created_by is not null then
      insert into public.admin_test_audit_log(actor_user_id, test_id, test_version_id, action, metadata)
      values (v.created_by, v.test_id, new_id, 'test_version_created',
        jsonb_build_object('version', next_num, 'repair_reason', 'krutidev typo correction', 'historical_version_preserved', true));
    end if;

    raise notice 'krutidev chapter repair: chapter-3 -> version %', next_num;
  else
    raise notice 'krutidev chapter repair: chapter-3 skipped (found=%, input_system=%)', found, coalesce(v.input_system_id, '-');
  end if;
end $ch3$;

do $ch4$
declare
  v public.test_versions%rowtype;
  next_num integer;
  new_id uuid;
  corrected constant text := 'ljnkj oYyHkHkkbZ iVsy Hkkjr ds egku Lora=rk lsukuh ekus tkrs gSA mudk thou –<+rk] lsok vkSj jk"Vzh; ,drk dk izrhd gSA mudk tUe bdrhl vDVwcj vBkjg lkS ipgRrj eas gqvk FkkA mudk ifjokj xqtjkr ds djeln x¡ko eas jgrk Fkk rcA muds firk >osjHkkbZ lkglh vkSj ifjJeh fdlku ekus tkrs FksA mudh ekrk ykMckbZ vR;ar /kkfeZd vkSj lknxhiw.kZ thou fcrkrh FkhaA oYyHkHkkbZ cpiu ls Lora= fopkj vkSj –<+ LoHkko j[krs FksA mUgkasus lhfer lk/kukas eas jgdj viuh izkjafHkd f''k{kk iwjh dhA ;qok voLFkk eas mUgkasus dkuwu dh i<+kbZ djus dk fu.kZ; fy;kA ifjJe vkSj vkRefo''okl ls og lQy odhy cus Fks tYnA ckn eas mUgkasus baXySaM tkdj mPp dkuwuh f''k{kk izkIr dhA i<+kbZ iwjh djds og Hkkjr ykSVs vkSj odkyr izkjaHk dhA iVsy dh odkyr lQy Fkh vkSj mUgas izfr"Bk feyh FkhA mudh rdZ''kfDr] rS;kjh vkSj fuHkhZdrk vnkyr eas fn[kkbZ nsrh FkhA og dfBu eqdnekas dks le>nkjh vkSj fo''okl ls yM+rs FksA fQj egkRek xka/kh ds fopkjkas us muds thou dks cnykA mUgkasus viuh O;fDrxr lQyrk NksM+dj tulsok dk ekxZ pquk FkkA jk"Vzh; vkanksyu eas mudk ;ksxnku yxkrkj vf/kd egRoiw.kZ curk x;kA xqtjkr ds [ksM+k ftys eas fdlkukas dh Qly u"V gqbZA blds ckotwn ljdkj us iwjk Hkwfe dj e¡kxk Fkk rcA iVsy us fdlkukas dh dfBukb;kas dks /;kuiwoZd le>k vkSj tkukA mUgkasus dj ekQh dh e¡kx ds fy, vkanksyu laxfBr fd;kA fdlkukas us ,drk vkSj vuq''kklu ds lkFk la?k"kZ fd;k FkkA varr% ljdkj dks dbZ egRoiw.kZ e¡kxas Lohdkj djuh iM+ha FkhaA ckjMksyh vkanksyu us iVsy dh usr`Ro {kerk izfl) dj nhA ljdkj us fdlkukas ij Hkwfe dj cgqr vf/kd c<+k;k FkkA iVsy us x¡kokas dk nkSjk djds turk dks laxfBr fd;kA mUgkasus vkanksyu dks iw.kZr% ''kkafriw.kZ vkSj vuq''kkflr cuk, j[kk FkkA LFkkuh; efgykvksa us mUgas lEekuiwoZd ljnkj dh mikf/k iznku dhA ckjMksyh dh lQyrk iwjs Lora=rk vkanksyu dh cM+h izsj.kk cuhA ljnkj iVsy dkaxzsl ds izeq[k vkSj izHkko''kkyh usrk cus FksA mUgkasus vlg;ksx vkSj lfou; voKk vkanksyukas eas lfdz; Hkkx fy;kA fCjfV''k ljdkj us mUgas vusd voljkas ij tsy Hkstk FkkA dkjkokl Hkh muds lkgl vkSj ladYi dks detksj ugha dj ldkA og laxBu] vuq''kklu vkSj O;kogkfjd jktuhfr eas fuiq.k ekus tkrsA mudh Li"Vokfnrk ls lg;ksxh vkSj fojks/kh nksukas izHkkfor gksrs FksA Hkkjr NksM+ks vkanksyu nkSjku mUgkasus turk dks lkgl fn;k FkkA vxLr méhl lkS c;kyhl eas vusd usrk fxj¶rkj gq, FksA iVsy us dkjkokl dh dfBu ifjfLFkfr;kas dk /kS;ZiwoZd lkeuk fd;kA Lora=rk fudV vkus ij ns''k ds lkeus ubZ pqukSfr;¡k FkhaA foHkktu us fgalk] foLFkkiu vkSj Hk; dk okrkoj.k cuk;k FkkA iVsy us O;oLFkk rFkk jkgr dk;kasZ ij fo''ks"k /;ku fn;kA Lora= Hkkjr eas iVsy igys miiz/kkuea=h vkSj x`gea=h cus FksA ns''k eas i¡kp lkS ls vf/kd ns''kh fj;klras ekStwn FkhaA mudk Lora= Hkkjr eas foy; vR;ar dfBu jktuhfrd dk;Z FkkA iVsy us laokn] le>kSrs vkSj –<+rk ls leL;k lqy>kbZ FkhA ohih esuu us bl egRoiw.kZ vfHk;ku eas mudk lg;ksx fd;kA vf/kdka''k ''kkldkas us foy;&i= ij ''kkafriwoZd gLrk{kj fd, FksA gSnjkckn vkSj twukx<+ tSlh fj;klrkas eas rRdkyhu ifjfLFkfr;¡k tfVy FkhaA iVsy us jk"Vzh; fgr dks loksZPp j[krs gq, fu.kZ; fy,A mudh –<+ uhfr us Hkkjr dk jktuhfrd ,dhdj.k laHko cuk;kA blh ;ksxnku dkj.k mUgas Hkkjr dk ykSg iq#"k dgk x;kA mUgkasus vf[ky Hkkjrh; lsokvksa dh fujarjrk dk leFkZu fd;kA ;g O;oLFkk iz''kklfud ,drk vkSj fLFkjrk ds fy, vko'';d FkhA ljnkj iVsy dk fu/ku ianzg fnlacj méhl lkS ipkl gqvkA mudh e`R;q ls iwjs ns''k eas xgjk ''kksd QSy x;kA Hkkjr us mUgas ej.kksijkar Hkkjr jRu ls lEekfur fd;k FkkA LVSP;w v‚Q ;wfuVh mudh ,sfrgkfld Hkwfedk dks n''kkZrh gSA mudk thou jk"Vzh; ,drk vkSj drZO; dk lans''k nsrk gSA fo|kFkhZ muls –<+ fu''p;] vuq''kklu vkSj usr`Ro lh[krs gSaA';
begin
  select ver.* into v
  from public.test_versions ver
  join public.tests t on t.current_version_id = ver.id
  where t.slug = 'chapter-4'
  for update of ver;

  if found and v.input_system_id = 'hindi-krutidev-010' and v.passage <> corrected then
    select coalesce(max(version_number), 0) + 1 into next_num
    from public.test_versions where test_id = v.test_id;

    insert into public.test_versions(
      test_id, version_number, title, description, language, mode, input_system_id, duration_seconds,
      passage, required_wpm, required_accuracy, backspace_mode, word_method, highlight_mode,
      visibility, passage_characters, passage_words, configuration, created_by
    ) values (
      v.test_id, next_num, v.title, v.description, v.language, v.mode, v.input_system_id, v.duration_seconds,
      corrected, v.required_wpm, v.required_accuracy, v.backspace_mode, v.word_method, v.highlight_mode,
      v.visibility, char_length(corrected),
      coalesce(array_length(regexp_split_to_array(btrim(corrected), '\s+'), 1), 0),
      coalesce(v.configuration, '{}'::jsonb) || jsonb_build_object(
        'passage_encoding', 'krutidev-legacy',
        'repair_reason', 'hand-typed wrong-key typos corrected (Chapter 4)'
      ),
      v.created_by
    ) returning id into new_id;

    update public.tests
    set current_version_id = new_id, current_version_number = next_num, updated_at = now()
    where id = v.test_id;

    if v.created_by is not null then
      insert into public.admin_test_audit_log(actor_user_id, test_id, test_version_id, action, metadata)
      values (v.created_by, v.test_id, new_id, 'test_version_created',
        jsonb_build_object('version', next_num, 'repair_reason', 'krutidev typo correction', 'historical_version_preserved', true));
    end if;

    raise notice 'krutidev chapter repair: chapter-4 -> version %', next_num;
  else
    raise notice 'krutidev chapter repair: chapter-4 skipped (found=%, input_system=%)', found, coalesce(v.input_system_id, '-');
  end if;
end $ch4$;

do $ch5$
declare
  v public.test_versions%rowtype;
  next_num integer;
  new_id uuid;
  corrected constant text := 'M‚DVj Hkhejko vkacsMdj vk/kqfud Hkkjr ds fopkjd ekus tkrs gSaA mudk thou f''k{kk] lekurk vkSj U;k; ds la?k"kZ dks n''kkZrk gSA mudk tUe 14 vizSy vBkjg lkS bD;kuos eas gqvk FkkA mudk tUeLFkku e/;izns''k dh egw lSfud Nkouh eas fLFkr FkkA muds firk jketh ldiky lsuk eas lwcsnkj in ij FksA mudh ekrk HkhekckbZ /kkfeZd vkSj ifjJeh efgyk ekuh tkrh FkhaA Hkhejko dk ifjokj lkekftd HksnHkko dh dfBukb;kas ls xqtjk FkkA fo|ky; eas mUgas vLi`'';rk vkSj vieku dk lkeuk djuk iM+kA dbZ ckj mUgas vU; fo|kfFkZ;kas ls vyx cSBk;k tkrk FkkA ikuh tSlh lkekU; lqfo/kk Hkh vklkuh ls miyC/k ugha gksrh FkhA bu vuqHkokas us muds eu ij xgjk izHkko NksM+k FkkA mUgkasus f''k{kk dks vU;k; lekIr djus dk ''kfDr''kkyh lk/ku ekukA Hkhejko izkjaHk ls gh vR;ar es/kkoh vkSj esgurh fo|kFkhZ FksA dfBu ifjfLFkfr;¡k mudh i<+kbZ ds izfr yxu ugha ?kVk ldhaA mUgkasus eaqcbZ fLFkr ,yfQaLVu fo|ky; ls f''k{kk izkIr dh FkhA mPp f''k{kk izkIr djuk muds leqnk; ds fy, vlk/kkj.k miyfC/k FkhA cM+kSnk ds egkjktk l;kthjko xk;dokM+ us mUgas Nk=o`fRr nh FkhA bl lgk;rk ls og fons''k eas v/;;u djus tk ldsA vkacsMdj us vesfjdk ds dksyafc;k fo''ofo|ky; eas v/;;u fd;k FkkA mUgkasus vFkZ''kkL=] jktuhfr] lekt''kkL= vkSj bfrgkl dk Kku ik;kA og¡k mUgas lekurk vkSj Lora=rk dk [kqyk okrkoj.k feyk FkkA mudh ''kks/k {kerk us vusd fo}kukas dks dkQh izHkkfor fd;kA ckn eas mUgkasus yanu eas fof/k vkSj vFkZ''kkL= i<+k FkkA mUgkasus dfBu vkfFkZd ifjfLFkfr;kas ds ckotwn v/;;u tkjh j[kkA Hkkjr ykSVus ij mUgas fQj lkekftd HksnHkko lguk iM+k FkkA mPp ;ksX;rk Hkh lekt dh ladh.kZ lksp ugha cny ldhA mUgkasus oafpr leqnk;kas ds vf/kdkjkas ds fy, vkanksyu izkjaHk fd;kA lekpkj i=kas }kjk mUgkasus lkekftd tkx:drk QSykus dk iz;kl fd;kA cfg"d`r fgrdkfj.kh lHkk us f''k{kk vkSj laxBu dks izksRlkgu fn;kA mudk lans''k f''kf{kr cuks] laxfBr jgks vkSj la?k"kZ djks FkkA vkacsMdj us lkoZtfud tyLjksrkas ij leku vf/kdkj dh e¡kx mBkbZA egkM+ lR;kxzg lkekftd lekurk dh fn''kk eas egRoiw.kZ dne FkkA mUgkasus tkfrxr HksnHkko dks ekuo xfjek ds fo#) crk;k FkkA eafnj izos''k vkanksyukas eas Hkh mUgkasus lfdz; usr`Ro fd;k FkkA mudk la?k"kZ fdlh O;fDr ugha] vU;k;iw.kZ O;oLFkk ds fo#) FkkA og yksdrkaf=d vkSj laoS/kkfud rjhdkas dks fo''ks"k egRo nsrs FksA Lora=rk vkanksyu nkSjku vkacsMdj egRoiw.kZ jktuhfrd ppkZvksa eas ''kkfey jgsA mUgkasus xksyest lEesyukas eas oafpr oxkasZ dk izfrfuf/kRo fd;k FkkA mudh e¡kx jktuhfrd Hkkxhnkjh vkSj lkekftd lqj{kk ls lacaf/kr FkhA egkRek xka/kh vkSj vkacsMdj ds fopkjkas eas erHksn jgs FksA fQj Hkh iwuk le>kSrs }kjk egRoiw.kZ lek/kku fudkyk x;k FkkA bl le>kSrs us vkjf{kr izfrfuf/kRo dh O;oLFkk dks izHkkfor fd;kA Lora= Hkkjr eas vkacsMdj igys dasnzh; dkuwu ea=h cus FksA mUgas lafo/kku lHkk dh izk:i lfefr dk v/;{k pquk x;kA mUgkasus lafo/kku fuekZ.k eas fo}rk vkSj ifjJe dk ifjp; fn;kA lafo/kku us ukxfjdkas dks lekurk vkSj Lora=rk ds vf/kdkj fn,A mlus vLi`'';rk lekIr djds lkekftd U;k; dh fn''kk fn[kkbZ FkhA vkacsMdj etcwr yksdra= ds fy, laoS/kkfud uSfrdrk vko'';d ekurs FksA mUgkasus efgykvksa ds vf/kdkjkas vkSj Jfed dY;k.k dk leFkZu fd;kA leku ukxfjd volj muds lkekftd n''kZu dk izeq[k vk/kkj FkkA mUgkasus vkfFkZd fodkl eas ty vkSj vkS|ksxhdj.k dk egRo le>k;kA muds fopkj f''k{kk] foRr vkSj ''kklu tSls {ks=kas rd QSysA og rdZ] oSKkfud –f"Vdks.k vkSj Lora= fparu dks egRo nsrsA mudh vusd iqLrdas vkt Hkh xaHkhj v/;;u dk fo"k; gSaA vkacsMdj us thou ds vafre le; ckS) /keZ viuk;k FkkA mUgkasus lekurk] d#.kk vkSj foosd ij vk/kkfjr ekxZ pqukA Ng fnlacj méhl lkS NIiu dks mudk fu/ku gqvk FkkA Hkkjr us mUgas ej.kksijkar Hkkjr jRu ls lEekfur fd;k FkkA mudh fojklr lkekftd U;k; vkSj yksdra= dks fujarj izsfjr djrhA fo|kFkhZ muds thou ls f''k{kk] lkgl vkSj lekurk lh[krs gSaA';
begin
  select ver.* into v
  from public.test_versions ver
  join public.tests t on t.current_version_id = ver.id
  where t.slug = 'chapter-5'
  for update of ver;

  if found and v.input_system_id = 'hindi-krutidev-010' and v.passage <> corrected then
    select coalesce(max(version_number), 0) + 1 into next_num
    from public.test_versions where test_id = v.test_id;

    insert into public.test_versions(
      test_id, version_number, title, description, language, mode, input_system_id, duration_seconds,
      passage, required_wpm, required_accuracy, backspace_mode, word_method, highlight_mode,
      visibility, passage_characters, passage_words, configuration, created_by
    ) values (
      v.test_id, next_num, v.title, v.description, v.language, v.mode, v.input_system_id, v.duration_seconds,
      corrected, v.required_wpm, v.required_accuracy, v.backspace_mode, v.word_method, v.highlight_mode,
      v.visibility, char_length(corrected),
      coalesce(array_length(regexp_split_to_array(btrim(corrected), '\s+'), 1), 0),
      coalesce(v.configuration, '{}'::jsonb) || jsonb_build_object(
        'passage_encoding', 'krutidev-legacy',
        'repair_reason', 'hand-typed wrong-key typos corrected (Chapter 5)'
      ),
      v.created_by
    ) returning id into new_id;

    update public.tests
    set current_version_id = new_id, current_version_number = next_num, updated_at = now()
    where id = v.test_id;

    if v.created_by is not null then
      insert into public.admin_test_audit_log(actor_user_id, test_id, test_version_id, action, metadata)
      values (v.created_by, v.test_id, new_id, 'test_version_created',
        jsonb_build_object('version', next_num, 'repair_reason', 'krutidev typo correction', 'historical_version_preserved', true));
    end if;

    raise notice 'krutidev chapter repair: chapter-5 -> version %', next_num;
  else
    raise notice 'krutidev chapter repair: chapter-5 skipped (found=%, input_system=%)', found, coalesce(v.input_system_id, '-');
  end if;
end $ch5$;

do $ch6$
declare
  v public.test_versions%rowtype;
  next_num integer;
  new_id uuid;
  corrected constant text := 'fnYyh tSls egkuxj eas lqjf{kr vkokl izR;sd ukxfjd dh ewyHkwr vko'';drk gSA fo''ks"k :i ls fo|kfFkZ;kas ds fy, jgus dk LFkku ,slk gksuk pkfg,] tg¡k os fcuk Hk; ds viuh i<+kbZ tkjh j[k ldasA fo''ofo|ky;kas vkSj egkfo|ky;kas ds vklikl cM+h la[;k eas futh Nk=kokl rFkk fdjk, ds dejs miyC/k gksrs gSaA bu LFkkukas ij jgus okys ;qokvksa ds ifjokj vDlj nwj jgrs gSaA blfy, Hkou ekfydkas vkSj LFkkuh; iz''kklu dh ftEesnkjh c<+ tkrh gSA Hkou fxjus tSlh nq?kZVuk,¡ geas ;kn fnykrh gSa fd lqfo/kk vkSj de fdjk, ds lkFk lqj{kk dks Hkh cjkcj egÙo nsuk vko'';d gSA

fdlh Hkh Hkou dh lqj{kk dsoy mlds ckgjh jax vkSj laqnj ltkoV ls fu/kkZfjr ugha gksrhA mldh uhao] nhokjkas] Nrkas vkSj [kaHkkas dh fLFkfr vf/kd egÙoiw.kZ gksrh gSA dbZ ckj ckgj ls vPNk fn[kkbZ nsus okyk edku Hkhrj ls detksj gks ldrk gSA nhokjkas eas c<+rh njkjas] Nr ls fxjrk iyLrj vkSj yxkrkj cuh jgus okyh lhyu /;ku nsus ;ksX; ladsr gSaA ,slh leL;kvksa dks ekewyh le>dj Vkyuk mfpr ugha gSA Hkou ekfyd dks fo''ks"kK ls fujh{k.k djkuk pkfg, vkSj vko'';d ejEer le; ij iwjh djokuh pkfg,A NksVh ykijokgh vkxs pydj vusd yksxkas ds thou dks ladV eas Mky ldrh gSA

fo|kfFkZ;kas dks dejk ysus ls igys miyC/k lqfo/kkvksa ds lkFk lqj{kk laca/kh tkudkjh Hkh izkIr djuh pkfg,A lh<+f;kas dh fLFkfr] ckgj fudyus dk jkLrk] fctyh ds rkj vkSj vko'';d laidZ fooj.k ns[kuk mi;ksxh gSA vfHkHkkodkas dks Hkh cPpkas ls muds jgus dh O;oLFkk ds ckjs eas fu;fer ckrphr djuh pkfg,A gkykafd rduhdh etcwrh dk vkdyu fo|kfFkZ;kas ls visf{kr ugha fd;k tk ldrkA ;g dk;Z ;ksX; fo''ks"kKkas dk gSA f''k{k.k laLFkku vklikl ds vkoklkas ds ckjs eas ekxZn''kZu nsdj lgk;rk dj ldrs gSaA f''kdk;r ntZ djkus dh ljy O;oLFkk gksus ls fo|kFkhZ viuh fpark fcuk f>>d lacaf/kr vf/kdkfj;kas rd igq¡pk ldrs gSaA

nq?kZVuk dh fLFkfr eas ?kcjkgV ds LFkku ij la;e vkSj lg;ksx dh vko'';drk gksrh gSA yksxkas dks cpko ny ds fy, jkLrk [kqyk j[kuk pkfg,A ?kVukLFky ds ikl HkhM+ yxkus] rLohjas ysus vkSj vQokg QSykus ls jkgr dk;Z izHkkfor gks ldrk gSA lgh tkudkjh vf/kd`r ek/;ekas ls izkIr djuh pkfg,A izHkkfor ifjokjkas dks lEekuiwoZd lwpuk nsuk vkSj mudh vko'';drkvksa dks le>uk Hkh egÙoiw.kZ gSA ?kk;ykas ds mipkj ds vfrfjDr lqjf{kr Bgjus] Hkkstu vkSj t:jh lkeku dh O;oLFkk ij /;ku nsuk pkfg,A ladV ls xqtj jgs fo|kfFkZ;kas dks i<+kbZ tkjh j[kus eas lgk;rk vkSj HkkoukRed lgkjk feyus ls mudk vkRefo''okl ykSV ldrk gSA

nh?kZdkfyd lq/kkj ds fy, fu;fer fujh{k.k] Li"V tokcnsgh vkSj le;c) dkjZokbZ vko'';d gSaA Hkou ekfydkas dks fdjk, ls gksus okyh vk; ds lkFk j[kj[kko dh ftEesnkjh Hkh Lohdkj djuh pkfg,A LFkkuh; laLFkkvksa dks f''kdk;rkas dk vfHkys[k j[kuk pkfg, vkSj xaHkhj ekeykas dk ''kh?j ijh{k.k djkuk pkfg,A lekt dks lqj{kk ds fo"k; ij dsoy nq?kZVuk ds ckn ppkZ djus rd lhfer ugha jguk pkfg,A tkx:drk dk;Zdzekas vkSj fu;fer laokn ls ftEesnkj O;ogkj fodflr gks ldrk gSA izR;sd fo|kFkhZ lqjf{kr okrkoj.k eas vius Hkfo"; dk fuekZ.k dj lds] ;gh lk>k mís''; gksuk pkfg,A thou dh j{kk ds izfr gekjh ltxrk gh csgrj uxj dh igpku cusxhA';
begin
  select ver.* into v
  from public.test_versions ver
  join public.tests t on t.current_version_id = ver.id
  where t.slug = 'chapter'
  for update of ver;

  if found and v.input_system_id = 'hindi-krutidev-010' and v.passage <> corrected then
    select coalesce(max(version_number), 0) + 1 into next_num
    from public.test_versions where test_id = v.test_id;

    insert into public.test_versions(
      test_id, version_number, title, description, language, mode, input_system_id, duration_seconds,
      passage, required_wpm, required_accuracy, backspace_mode, word_method, highlight_mode,
      visibility, passage_characters, passage_words, configuration, created_by
    ) values (
      v.test_id, next_num, v.title, v.description, v.language, v.mode, v.input_system_id, v.duration_seconds,
      corrected, v.required_wpm, v.required_accuracy, v.backspace_mode, v.word_method, v.highlight_mode,
      v.visibility, char_length(corrected),
      coalesce(array_length(regexp_split_to_array(btrim(corrected), '\s+'), 1), 0),
      coalesce(v.configuration, '{}'::jsonb) || jsonb_build_object(
        'passage_encoding', 'krutidev-legacy',
        'repair_reason', 'hand-typed wrong-key typos corrected (Chapter 6)'
      ),
      v.created_by
    ) returning id into new_id;

    update public.tests
    set current_version_id = new_id, current_version_number = next_num, updated_at = now()
    where id = v.test_id;

    if v.created_by is not null then
      insert into public.admin_test_audit_log(actor_user_id, test_id, test_version_id, action, metadata)
      values (v.created_by, v.test_id, new_id, 'test_version_created',
        jsonb_build_object('version', next_num, 'repair_reason', 'krutidev typo correction', 'historical_version_preserved', true));
    end if;

    raise notice 'krutidev chapter repair: chapter -> version %', next_num;
  else
    raise notice 'krutidev chapter repair: chapter skipped (found=%, input_system=%)', found, coalesce(v.input_system_id, '-');
  end if;
end $ch6$;

do $ch9$
declare
  v public.test_versions%rowtype;
  next_num integer;
  new_id uuid;
  corrected constant text := 'i;kZoj.k gekjs thou dk vk/kkj gSA ok;q] ty] feV~Vh] ouLifr vkSj tho feydj gekjs vklikl dk izkd`frd lalkj cukrs gSaA euq"; viuh vko'';drkvksa dh iwfrZ ds fy, izd`fr ij fuHkZj jgrk gSA Hkkstu ls ysdj vkokl rd izR;sd {ks= eas izkd`frd lalk/kukas dh Hkwfedk gksrh gSA blfy, i;kZoj.k dh ns[kHkky dsoy ljdkj ;k fdlh laLFkk dk dke ugha gSA izR;sd ukxfjd vius nSfud O;ogkj ls bleas ;ksxnku ns ldrk gSA LoPN vkSj larqfyr ifjos''k cuk, j[kus ds fy, geas viuh vknrkas ij fopkj djuk gksxkA NksVs iz;kl feydj ifjorZu yk ldrs gSa] ;fn mUgas fujarj viuk;k tk,A
ty dk le>nkjh ls mi;ksx i;kZoj.k laj{k.k dh ''kq#vkr gSA ?kjkas eas [kqyk uy NksM+ nsuk] vko'';drk ls vf/kd ikuh cgkuk vkSj fjlko dh vuns[kh djuk lkekU; ykijokfg;¡k gSaA bUgas lq/kkjus ds fy, fdlh cM+h ;kstuk dh izrh{kk vko'';d ugha gSA mi;ksx ds ckn uy can djuk vkSj [kjkc midj.kkas dh ejEer djokuk gekjh ftEesnkjh gSA o"kkZ ds ikuh dks ,d= djus dh O;oLFkk Hkh mi;ksxh gks ldrh gSA lkFk gh rkykckas] ufn;kas vkSj vU; ty L=ksrkas eas dpjk Mkyus ls cpuk pkfg,A lkoZtfud lalk/kukas dks viuk le>dj mudh j{kk djus dh Hkkouk fodflr djuk vko'';d gSA
dpjs dk mfpr izca/ku Hkh ukxfjd thou dk egÙoiw.kZ fgLlk gSA ?kj dh lQkbZ djds dpjk lM+d ij Qasd nsuk LoPNrk ugha dgykrkA geas xhys vkSj lw[ks dpjs dks vyx j[kus dh vknr Mkyuh pkfg,A mi;ksx ;ksX; oLrqvksa dks rqjar Qasdus ds ctk; mudh ejEer ;k nksckjk mi;ksx ij fopkj fd;k tk ldrk gSA [kjhnkjh ds le; fVdkÅ FkSyk lkFk j[kuk ,d ljy dne gSA vuko'';d iSfdax okyh oLrqvksa ls cpuk Hkh mi;ksxh gSA LoPNrk deZpkfj;kas ds Je dk lEeku djrs gq, geas dpjk fu/kkZfjr LFkku ij nsuk pkfg,A lkQ xfy;¡k vkSj lkoZtfud LFky lkewfgd lg;ksx ls curs gSaA
isM+ gekjs vklikl gfj;kyh vkSj Nk;k iznku djrs gSaA ikS/ks yxkuk vPNk dk;Z gS] ysfdu mudh fu;fer ns[kHkky djuk mruk gh vko'';d gSA dsoy fo''ks"k volj ij ikS/kk yxkdj Hkwy tkus ls mís''; iwjk ugha gksrkA mfpr LFkku vkSj LFkkuh; ifjfLFkfr;kas ds vuqlkj ikS/kkas dk p;u djuk pkfg,A ikuh nsuk] mudh lqj{kk djuk vkSj fodkl ij /;ku j[kuk ftEesnkjh dk fgLlk gSA fo|ky;kas eas fo|kFkhZ feydj ikS/kkas dh ns[kHkky dj ldrs gSaA blls mueas izd`fr ds izfr yxko vkSj lg;ksx dh Hkkouk c<+sxhA vklikl ds iqjkus isM+kas rFkk [kqys LFkkukas ds laj{k.k ij Hkh lekt dks /;ku nsuk pkfg,A
i;kZoj.k ds izfr ftEesnkjh gekjs miHkksx vkSj ;k=k laca/kh fu.kZ;kas eas Hkh fn[kkbZ nsuh pkfg,A vko'';drk u gksus ij fctyh ds midj.k can djuk ,d vPNh vknr gSA de nwjh ds fy, ifjfLFkfr ds vuqlkj iSny pyuk ;k lkbfdy pquuk mi;ksxh gks ldrk gSA oLrq,¡ dsoy vko'';drk ds vuqlkj [kjhnus ls vuko'';d laxzg ?kVrk gSA cPpkas dks bu vknrkas dk egÙo le>kus ds fy, cM+kas dks Lo;a mnkgj.k izLrqr djuk pkfg,A ifjorZu dh ''kq#vkr vius ?kj] fo|ky; vkSj eksgYys ls gks ldrh gSA izd`fr dh j{kk dks nSfud thou dk fgLlk cukdj ge vkus okyh ih<+f;kas ds fy, csgrj ifjos''k rS;kj dj ldrs gSaA';
begin
  select ver.* into v
  from public.test_versions ver
  join public.tests t on t.current_version_id = ver.id
  where t.slug = 'chapter-9'
  for update of ver;

  if found and v.input_system_id = 'hindi-krutidev-010' and v.passage <> corrected then
    select coalesce(max(version_number), 0) + 1 into next_num
    from public.test_versions where test_id = v.test_id;

    insert into public.test_versions(
      test_id, version_number, title, description, language, mode, input_system_id, duration_seconds,
      passage, required_wpm, required_accuracy, backspace_mode, word_method, highlight_mode,
      visibility, passage_characters, passage_words, configuration, created_by
    ) values (
      v.test_id, next_num, v.title, v.description, v.language, v.mode, v.input_system_id, v.duration_seconds,
      corrected, v.required_wpm, v.required_accuracy, v.backspace_mode, v.word_method, v.highlight_mode,
      v.visibility, char_length(corrected),
      coalesce(array_length(regexp_split_to_array(btrim(corrected), '\s+'), 1), 0),
      coalesce(v.configuration, '{}'::jsonb) || jsonb_build_object(
        'passage_encoding', 'krutidev-legacy',
        'repair_reason', 'hand-typed wrong-key typos corrected (Chapter 9)'
      ),
      v.created_by
    ) returning id into new_id;

    update public.tests
    set current_version_id = new_id, current_version_number = next_num, updated_at = now()
    where id = v.test_id;

    if v.created_by is not null then
      insert into public.admin_test_audit_log(actor_user_id, test_id, test_version_id, action, metadata)
      values (v.created_by, v.test_id, new_id, 'test_version_created',
        jsonb_build_object('version', next_num, 'repair_reason', 'krutidev typo correction', 'historical_version_preserved', true));
    end if;

    raise notice 'krutidev chapter repair: chapter-9 -> version %', next_num;
  else
    raise notice 'krutidev chapter repair: chapter-9 skipped (found=%, input_system=%)', found, coalesce(v.input_system_id, '-');
  end if;
end $ch9$;

commit;
