/* Every string the app shows, in English and Chinese. t("key") picks the current language;
 * a key missing from zh falls back to en, and a missing key shows itself so it's easy to spot.
 * Built-in option values (techniques, stages, default tags...) are stored as keys like "cup"
 * and shown through label(); anything the user types is stored and shown as typed. */
"use strict";

const STRINGS = {
  en: {
    app: "Clay Journal",
    "tab.pieces": "Pieces", "tab.gallery": "Gallery", "tab.firings": "Firings", "tab.ideas": "Ideas", "tab.settings": "Settings",
    "btn.newPiece": "New piece", "btn.newFiring": "New firing", "btn.newDesign": "New design", "btn.newInsp": "New inspiration",
    "btn.addPhoto": "Add photo", "btn.takePhoto": "Take photo", "btn.addRow": "Add clay", "btn.delete": "Delete", "btn.done": "Done",
    "btn.cancel": "Cancel", "btn.save": "Save", "btn.back": "Back", "btn.add": "Add", "btn.clear": "Clear filters",
    "btn.openPiece": "Open piece", "btn.cover": "Make cover", "btn.addPieces": "Add pieces",
    "confirm.deletePiece": "Delete this piece and its photos?", "confirm.deleteFiring": "Delete this firing? Pieces stay, just unlinked.",
    "confirm.deleteDesign": "Delete this design?", "confirm.deleteInsp": "Delete this inspiration?", "confirm.deletePhoto": "Delete this photo?",
    untitled: "Untitled", search: "Search", none: "None", newFiringOpt: "+ New firing", optional: "optional",
    "empty.pieces": "No pieces yet. Tap New piece after your next session at the wheel.",
    "empty.gallery": "No photos match. Photos you add to pieces show up here.",
    "empty.firings": "No firings yet. Log a kiln run here, or create one from a piece's bisque or glaze stage.",
    "empty.designs": "No designs yet. Upload a sketch or write down an idea.",
    "empty.insp": "No inspiration saved yet. Screenshots from Xiaohongshu, photos from a gallery visit...",
    "empty.linked": "No pieces linked yet.",

    "sec.basics": "Basics", "sec.clay": "Clay", "sec.wet": "Wet stage", "sec.bisque": "Bisque stage", "sec.glaze": "Glaze stage",
    "sec.final": "Final stage", "sec.photos": "Photos", "sec.links": "Design & inspiration", "sec.sales": "Sales",

    "f.title": "Title", "f.started": "Date started", "f.technique": "Technique", "f.tags": "Category tags", "f.notes": "Notes",
    "f.clayType": "Clay type", "f.grams": "Grams", "f.totalClay": "Total clay", "f.dims": "Dimensions", "f.unit": "Unit",
    "f.length": "L", "f.width": "W", "f.height": "H", "f.weight": "Weight (g)", "f.weightTrimmed": "Weight after trimming (g)",
    "f.trimmedOff": "Trimmed off", "f.dryDays": "Drying time (days)", "f.dryNotes": "Drying notes",
    "f.dimsBisque": "Dimensions after bisque", "f.weightBisque": "Weight after bisque (g)", "f.shrinkBisque": "Shrinkage wet → bisque",
    "f.firing": "Firing", "f.glazes": "Glazes", "f.method": "Application", "f.dimsFinal": "Final dimensions",
    "f.weightFinal": "Final weight (g)", "f.shrinkFinal": "Total shrinkage wet → final", "f.outcome": "Outcome", "f.defects": "Defects",
    "f.defectOther": "Other defect", "f.design": "Based on design", "f.inspirations": "Inspiration used",
    "f.saleStatus": "Sale status", "f.askPrice": "Asking price", "f.salePrice": "Sale price", "f.channel": "Platform / channel",
    "f.soldDate": "Sold date", "f.buyer": "Buyer note", "f.photoStage": "Stage", "f.photoTags": "Tags",
    "f.date": "Date", "f.firingType": "Firing type", "f.cone": "Cone / temperature", "f.kiln": "Kiln", "f.linked": "Pieces in this firing",
    "f.image": "Image", "f.description": "Description", "f.status": "Status", "f.sparkedBy": "Sparked by", "f.resultPiece": "Resulting piece",
    "f.source": "Source", "f.myNotes": "My notes", "f.usedBy": "Used by", "f.dateFrom": "From", "f.dateTo": "To",
    "f.handle": "Handle (optional)", "f.handleCut": "Handle length when cut", "f.handleDims": "Handle once attached",
    "f.shrinkHandleB": "Handle shrinkage wet → bisque", "f.shrinkHandleF": "Handle shrinkage wet → final",
    "f.addStage": "New photos go to", "avg": "avg", "addTag": "Add tag…", "addGlaze": "Add glaze…",

    "stage.wet": "Wet clay", "stage.bisque": "Bisque", "stage.glazed": "Glazed", "stage.final": "Final",
    "tech.wheel": "Wheel throwing", "tech.hand": "Hand-building", "tech.coil": "Coil", "tech.slab": "Slab", "tech.pinch": "Pinch", "tech.marbled": "Marbled clay (绞胎)",
    "tag.cup": "Cup", "tag.plate": "Plate", "tag.bowl": "Bowl", "tag.vase": "Vase", "tag.marbled": "Marbled clay", "tag.coffee_cup": "Coffee cup",
    "clay.white": "White clay", "clay.red": "Red clay", "clay.black": "Black clay", "clay.stoneware": "Stoneware", "clay.porcelain": "Porcelain",
    "method.dip": "Dipping", "method.spray": "Spraying", "method.brush": "Brushing",
    "outcome.success": "Success", "outcome.failed": "Failed", "outcome.partial": "Partial issue",
    "defect.crack": "Cracking", "defect.warp": "Warping", "defect.crawl": "Glaze crawling", "defect.pinhole": "Pinholes", "defect.color": "Color mismatch", "defect.other": "Other",
    "sale.not": "Not for sale", "sale.for": "For sale", "sale.sold": "Sold",
    "chan.instagram": "Instagram", "chan.xhs": "Xiaohongshu", "chan.inperson": "In person", "chan.market": "Market stall",
    "ftype.bisque": "Bisque", "ftype.glaze": "Glaze", "ftype.wood": "Wood firing (柴烧)", "ftype.raku": "Raku", "ftype.other": "Other",
    "dstatus.concept": "Concept", "dstatus.attempted": "Attempted", "dstatus.completed": "Completed as piece",
    "ideas.designs": "Designs", "ideas.insp": "Inspiration",
    "filter.tag": "Tag", "filter.stage": "Stage", "filter.technique": "Technique", "filter.sale": "Sale", "filter.outcome": "Outcome", "filter.date": "Date",
    "photos.count": "{n} photos", "pieces.count": "{n} pieces", "photos.one": "1 photo", "pieces.one": "1 piece",

    "set.language": "Language", "set.account": "Account", "set.email": "Email", "set.password": "Password",
    "set.signIn": "Sign in", "set.signUp": "Create account", "set.signOut": "Sign out", "set.forgot": "Forgot password",
    "set.signedInAs": "Signed in as {email}", "set.syncNow": "Sync now", "set.lastSync": "Last synced {when}",
    "set.accountHint": "Sign in to keep everything, photos included, safe in the cloud and on more than one phone. Same account as Bùbù and Cheat Days.",
    "set.checkEmail": "Check your email to confirm the account, then sign in.", "set.resetSent": "Reset email sent.",
    "set.currency": "Currency symbol", "set.unit": "Default unit", "set.lists": "Your lists",
    "set.listTags": "Category tags", "set.listClay": "Clay types", "set.listGlazes": "Glazes", "set.listChannels": "Channels",
    "set.backup": "Backup", "set.export": "Export all data (JSON)", "set.import": "Import from JSON", "set.imported": "Imported and merged.",
    "set.update": "App version", "set.forceUpdate": "Force update", "set.updating": "Updating…", "set.updated": "Up to date",
    "set.updateHint": "The app updates itself when it opens. If something still looks old, this reloads it fresh from the server. Your pieces and photos aren't touched.",
    "set.pending": "{n} photos waiting to upload", "set.stats": "{p} pieces · {f} firings · {d} designs · {i} inspiration",

    "sync.offline": "Offline: changes are saved on this phone", "sync.syncing": "Syncing…", "sync.ok": "Synced", "sync.err": "Sync failed: {msg}",
    "sync.needSignIn": "Photos stay on this phone until you sign in.", "sync.table": "The pottery table is missing in Supabase. Run the SQL from the README.",
    "just now": "just now", "min ago": "{n} min ago", "h ago": "{n} h ago", "d ago": "{n} d ago",
  },
  zh: {
    app: "陶记",
    "tab.pieces": "作品", "tab.gallery": "图库", "tab.firings": "烧制", "tab.ideas": "灵感", "tab.settings": "设置",
    "btn.newPiece": "新作品", "btn.newFiring": "新烧制", "btn.newDesign": "新设计", "btn.newInsp": "新灵感",
    "btn.addPhoto": "添加照片", "btn.takePhoto": "拍照", "btn.addRow": "添加泥料", "btn.delete": "删除", "btn.done": "完成",
    "btn.cancel": "取消", "btn.save": "保存", "btn.back": "返回", "btn.add": "添加", "btn.clear": "清除筛选",
    "btn.openPiece": "打开作品", "btn.cover": "设为封面", "btn.addPieces": "添加作品",
    "confirm.deletePiece": "删除这件作品及其照片？", "confirm.deleteFiring": "删除这次烧制？作品会保留，只是取消关联。",
    "confirm.deleteDesign": "删除这个设计？", "confirm.deleteInsp": "删除这条灵感？", "confirm.deletePhoto": "删除这张照片？",
    untitled: "未命名", search: "搜索", none: "无", newFiringOpt: "+ 新建烧制", optional: "可选",
    "empty.pieces": "还没有作品。下次拉坯结束后点「新作品」。",
    "empty.gallery": "没有符合条件的照片。添加到作品里的照片会显示在这里。",
    "empty.firings": "还没有烧制记录。可以在这里记录一窑，也可以在作品的素烧或釉烧阶段直接新建。",
    "empty.designs": "还没有设计。上传草图，或者写下一个想法。",
    "empty.insp": "还没有保存灵感。小红书截图、展览照片……",
    "empty.linked": "还没有关联作品。",

    "sec.basics": "基本信息", "sec.clay": "泥料", "sec.wet": "湿坯阶段", "sec.bisque": "素烧阶段", "sec.glaze": "上釉阶段",
    "sec.final": "成品阶段", "sec.photos": "照片", "sec.links": "设计与灵感", "sec.sales": "销售",

    "f.title": "名称", "f.started": "开始日期", "f.technique": "成型方式", "f.tags": "分类标签", "f.notes": "备注",
    "f.clayType": "泥料", "f.grams": "克数", "f.totalClay": "泥料总重", "f.dims": "尺寸", "f.unit": "单位",
    "f.length": "长", "f.width": "宽", "f.height": "高", "f.weight": "重量（克）", "f.weightTrimmed": "修坯后重量（克）",
    "f.trimmedOff": "修掉", "f.dryDays": "干燥时间（天）", "f.dryNotes": "干燥备注",
    "f.dimsBisque": "素烧后尺寸", "f.weightBisque": "素烧后重量（克）", "f.shrinkBisque": "收缩率 湿坯 → 素烧",
    "f.firing": "烧制", "f.glazes": "釉料", "f.method": "施釉方式", "f.dimsFinal": "成品尺寸",
    "f.weightFinal": "成品重量（克）", "f.shrinkFinal": "总收缩率 湿坯 → 成品", "f.outcome": "结果", "f.defects": "缺陷",
    "f.defectOther": "其他缺陷", "f.design": "参考的设计", "f.inspirations": "参考的灵感",
    "f.saleStatus": "销售状态", "f.askPrice": "标价", "f.salePrice": "成交价", "f.channel": "平台 / 渠道",
    "f.soldDate": "售出日期", "f.buyer": "买家备注", "f.photoStage": "阶段", "f.photoTags": "标签",
    "f.date": "日期", "f.firingType": "烧制类型", "f.cone": "测温锥 / 温度", "f.kiln": "窑", "f.linked": "这一窑的作品",
    "f.image": "图片", "f.description": "描述", "f.status": "状态", "f.sparkedBy": "灵感来源", "f.resultPiece": "做成的作品",
    "f.source": "来源", "f.myNotes": "我的笔记", "f.usedBy": "被引用", "f.dateFrom": "从", "f.dateTo": "到",
    "f.handle": "把手（可选）", "f.handleCut": "把手裁切时的长度", "f.handleDims": "装好后的把手",
    "f.shrinkHandleB": "把手收缩率 湿坯 → 素烧", "f.shrinkHandleF": "把手收缩率 湿坯 → 成品",
    "f.addStage": "新照片归入", "avg": "平均", "addTag": "添加标签…", "addGlaze": "添加釉料…",

    "stage.wet": "湿坯", "stage.bisque": "素烧", "stage.glazed": "已上釉", "stage.final": "成品",
    "tech.wheel": "拉坯", "tech.hand": "手捏成型", "tech.coil": "泥条盘筑", "tech.slab": "泥板成型", "tech.pinch": "捏塑", "tech.marbled": "绞胎",
    "tag.cup": "杯", "tag.plate": "盘", "tag.bowl": "碗", "tag.vase": "花瓶", "tag.marbled": "绞胎", "tag.coffee_cup": "咖啡杯",
    "clay.white": "白泥", "clay.red": "红泥", "clay.black": "黑泥", "clay.stoneware": "炻器泥", "clay.porcelain": "瓷泥",
    "method.dip": "浸釉", "method.spray": "喷釉", "method.brush": "刷釉",
    "outcome.success": "成功", "outcome.failed": "失败", "outcome.partial": "部分问题",
    "defect.crack": "开裂", "defect.warp": "变形", "defect.crawl": "缩釉", "defect.pinhole": "针孔", "defect.color": "色差", "defect.other": "其他",
    "sale.not": "不出售", "sale.for": "出售中", "sale.sold": "已售出",
    "chan.instagram": "Instagram", "chan.xhs": "小红书", "chan.inperson": "线下", "chan.market": "市集摊位",
    "ftype.bisque": "素烧", "ftype.glaze": "釉烧", "ftype.wood": "柴烧", "ftype.raku": "乐烧", "ftype.other": "其他",
    "dstatus.concept": "构思", "dstatus.attempted": "尝试中", "dstatus.completed": "已做成作品",
    "ideas.designs": "设计", "ideas.insp": "灵感",
    "filter.tag": "标签", "filter.stage": "阶段", "filter.technique": "成型方式", "filter.sale": "销售", "filter.outcome": "结果", "filter.date": "日期",
    "photos.count": "{n} 张照片", "pieces.count": "{n} 件作品",

    "set.language": "语言", "set.account": "账号", "set.email": "邮箱", "set.password": "密码",
    "set.signIn": "登录", "set.signUp": "注册", "set.signOut": "退出登录", "set.forgot": "忘记密码",
    "set.signedInAs": "已登录：{email}", "set.syncNow": "立即同步", "set.lastSync": "上次同步：{when}",
    "set.accountHint": "登录后，所有记录和照片都会保存在云端，换手机或多台设备都能用。和步步、Cheat Days 用同一个账号。",
    "set.checkEmail": "请到邮箱确认账号，然后登录。", "set.resetSent": "重置邮件已发送。",
    "set.currency": "货币符号", "set.unit": "默认单位", "set.lists": "我的列表",
    "set.listTags": "分类标签", "set.listClay": "泥料", "set.listGlazes": "釉料", "set.listChannels": "渠道",
    "set.backup": "备份", "set.export": "导出全部数据（JSON）", "set.import": "从 JSON 导入", "set.imported": "已导入并合并。",
    "set.update": "应用版本", "set.forceUpdate": "强制更新", "set.updating": "正在更新…", "set.updated": "已是最新版本",
    "set.updateHint": "应用打开时会自动更新。如果看起来还是旧版本，点这里从服务器重新加载。作品和照片都不会受影响。",
    "set.pending": "{n} 张照片等待上传", "set.stats": "{p} 件作品 · {f} 次烧制 · {d} 个设计 · {i} 条灵感",

    "sync.offline": "离线：改动已保存在这台手机上", "sync.syncing": "同步中…", "sync.ok": "已同步", "sync.err": "同步失败：{msg}",
    "sync.needSignIn": "登录前，照片只保存在这台手机上。", "sync.table": "Supabase 里缺少 pottery 表，请运行 README 里的 SQL。",
    "just now": "刚刚", "min ago": "{n} 分钟前", "h ago": "{n} 小时前", "d ago": "{n} 天前",
  }
};

let LANG = "en";
function setLang(l) { LANG = STRINGS[l] ? l : "en"; document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en"; }
function t(key, vars) {
  if (vars && vars.n === 1 && key.endsWith(".count") && (STRINGS[LANG] || {})[key.replace(".count", ".one")]) key = key.replace(".count", ".one");
  let s = (STRINGS[LANG] && STRINGS[LANG][key]) || STRINGS.en[key] || key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}
/** Show a stored option value: built-ins through the string table, user-typed values as they are. */
function label(prefix, value) {
  const k = `${prefix}.${value}`;
  return STRINGS.en[k] ? t(k) : String(value);
}
