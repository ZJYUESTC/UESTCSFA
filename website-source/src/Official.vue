<script setup>
import {ref,onMounted,onUnmounted,computed} from 'vue'
import logoUrl from './uestcsfa-logo.png'
import initialContent from './initial-content.json'
import debateQr from './debate-qr.jpg'
import {readCache,loadContent} from './content.js'
import posterUrl from './about-media/poster.webp'
import awardPhoto from './about-media/award.webp'
import photo01 from './about-media/photo-01.webp'
import photo02 from './about-media/photo-02.webp'
import photo03 from './about-media/photo-03.webp'
import photo04 from './about-media/photo-04.webp'
import photo05 from './about-media/photo-05.webp'
import photo06 from './about-media/photo-06.webp'
import photo07 from './about-media/photo-07.webp'
import photo08 from './about-media/photo-08.webp'
import photo09 from './about-media/photo-09.webp'

const initialEvents=initialContent.events.map(x=>({...x,image:debateQr}))
const page=ref('home'),news=ref(readCache('news',initialContent.news)),events=ref(readCache('events',initialEvents))
function refreshContent(){for(const [kind,target] of [['news',news],['events',events],['games',games]])loadContent(kind).then(items=>target.value=items).catch(()=>{})}
const photos=[awardPhoto,photo01,photo02,photo03,photo04,photo05,photo06,photo07,photo08,photo09]
const slide=ref(0),pauseSlides=ref(false),photoLoading=ref(true)
let slideTimer
function slideTo(index){photoLoading.value=true;slide.value=(index+photos.length)%photos.length}
const games=ref(readCache('games',[{"id": "quiz", "kind": "quiz", "title": "趣味问答", "description": "10 道科幻知识题"}, {"id": "star-routes", "kind": "link", "title": "远星航路", "description": "回合制星舰战术游戏", "url": "https://zjyuestc.github.io/UESTCSFA/games/star-routes/index.html"}]))
const questions=[
 {q:'《三体》的作者是谁？',a:['刘慈欣','郝景芳','王晋康'],c:0},
 {q:'阿西莫夫提出的著名机器人规则称为？',a:['机器人三定律','黑暗森林法则','零号协议'],c:0},
 {q:'《银河系漫游指南》中，生命、宇宙以及一切的终极答案是？',a:['42','7','101'],c:0},
 {q:'《沙丘》故事中的珍贵资源“香料”主要产自哪颗星球？',a:['厄拉科斯','索拉里斯','克里普顿'],c:0},
 {q:'《星际迷航》中，企业号是一艘什么？',a:['星舰','潜艇','时间机器'],c:0},
 {q:'《基地》系列中，谢顿用来预测大规模社会趋势的学科是？',a:['心理史学','量子考古学','地外语言学'],c:0},
 {q:'《海底两万里》中，尼摩船长的潜艇名叫？',a:['鹦鹉螺号','企业号','发现号'],c:0},
 {q:'《时间机器》的作者是？',a:['赫伯特·乔治·威尔斯','儒勒·凡尔纳','菲利普·迪克'],c:0},
 {q:'《仿生人会梦见电子羊吗？》的作者是？',a:['菲利普·迪克','艾萨克·阿西莫夫','特德·姜'],c:0},
 {q:'《2001太空漫游》中的飞船电脑叫什么？',a:['HAL 9000','R2-D2','天网'],c:0},
]
const step=ref(0),answers=ref([]),finished=computed(()=>step.value>=questions.length),score=computed(()=>answers.value.filter((x,i)=>x===questions[i].c).length)
function choose(i){answers.value[step.value]=i;step.value++}
function restart(){step.value=0;answers.value=[]}
function startGame(game){if(game.kind==='quiz'){restart();navigate('quiz')}else if(game.kind==='link')window.open(game.url,'_blank','noopener,noreferrer')}
function navigate(to){if(['news','events','games'].includes(to))refreshContent();page.value=to;window.scrollTo({top:0,behavior:'smooth'})}
onMounted(()=>{refreshContent();if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)slideTimer=setInterval(()=>{if(page.value==='about'&&!pauseSlides.value&&!photoLoading.value&&!document.hidden)slideTo(slide.value+1)},7000)})
onUnmounted(()=>{clearInterval(slideTimer)})
</script>
<template>
<div class="site-shell">
 <header class="site-header"><button class="site-brand" @click="navigate('home')"><img class="brand-logo" :src="logoUrl" alt="电子科技大学科幻协会标志"><span><b>银杏科幻</b><small>电子科技大学科幻协会</small></span></button><nav aria-label="主导航"><button v-for="item in [['home','首页'],['about','协会介绍'],['news','资讯'],['events','活动通知'],['games','科幻小游戏']]" :key="item[0]" :class="{active:page===item[0]||(item[0]==='games'&&page==='quiz')}" @click="navigate(item[0])">{{item[1]}}</button></nav></header>
 <main>
  <section v-if="page==='home'" class="site-hero"><div class="hero-copy"><h1>电子科技大学<br>科幻协会</h1><p>成立于2018年 · 成电幻协</p><button class="gold-button" @click="navigate('about')">协会介绍</button></div><img class="home-photo" :src="photo03" alt="电子科技大学科幻协会活动合影"></section>
  <section v-if="page==='home'" class="home-panels"><button @click="navigate('news')">资讯</button><button @click="navigate('events')">活动通知</button><button @click="navigate('games')">科幻小游戏</button></section>
  <section v-if="page==='about'" class="site-page about-page"><div class="page-heading"><h1>电子科技大学科幻协会</h1></div><div class="about-feature"><div class="about-exact"><p>电子科技大学科幻协会（成电幻协）成立于2018年，目前学生社团成员规模达300余人。这里欢迎每一位对科幻感兴趣的同学：我们可以聊作品、开脑洞，交流阅读与观影心得，也可以分享自己的创作想法。</p><p>协会日常开展科创征文比赛、科创电影剧情创作、科幻桌游大赛等活动，也组织科幻沙龙、线上共读、作品猜谜、观影和手工拼装。协会会组织学生参观《科幻世界》编辑部，参与中国国际科幻大会等大型科创类盛会的志愿服务，并与其他高校的科创协会交流分享。</p><p>除了这些活动，协会还会举办科幻图书角、“一句话科幻”征文、校内放映会等活动，以及设立写作、科技等兴趣小组。</p><p>我们希望成电幻协成为同学们进一步了解科幻的一扇窗户，也成为分享想象与结识同好的地方。</p></div><figure class="association-poster"><img :src="posterUrl" alt="电子科技大学科幻协会海报" decoding="async"><figcaption>协会海报</figcaption></figure></div><section class="about-honor"><div><h2>协会荣誉</h2><p>第三十五届银河奖最佳科幻团体奖——电子科技大学科幻协会。</p></div></section><section class="about-gallery" aria-label="协会照片"><div class="gallery-heading"><h2>活动影像</h2><span>{{String(slide+1).padStart(2,'0')}} / {{String(photos.length).padStart(2,'0')}}</span></div><div class="gallery-view" @mouseenter="pauseSlides=true" @mouseleave="pauseSlides=false" @focusin="pauseSlides=true" @focusout="pauseSlides=false"><span v-if="photoLoading" class="gallery-loading">照片加载中…</span><img :key="photos[slide]" :src="photos[slide]" :alt="'协会照片 '+(slide+1)" @load="photoLoading=false" @error="photoLoading=false"><button class="gallery-prev" aria-label="上一张照片" @click="slideTo(slide-1)">‹</button><button class="gallery-next" aria-label="下一张照片" @click="slideTo(slide+1)">›</button></div><div class="gallery-dots" aria-label="选择照片"><button v-for="(_,index) in photos" :key="index" :class="{active:index===slide}" :aria-label="'第 '+(index+1)+' 张照片'" :aria-current="index===slide?'true':undefined" @click="slideTo(index)"></button></div></section></section>
  <section v-if="page==='news'||page==='events'" class="site-page"><div class="page-heading"><h1>{{page==='news'?'资讯':'活动通知'}}</h1></div><div class="story-list"><article v-for="x in page==='news'?news:events" :key="x.id"><div class="story-content"><small v-if="x.publishedAt">{{x.publishedAt}}</small><h2>{{x.title}}</h2><p>{{x.body}}</p><img v-if="x.image" class="event-image" :src="x.image" :alt="x.imageAlt" loading="lazy"></div></article></div></section>
  <section v-if="page==='games'" class="site-page games-page"><div class="page-heading"><h1>科幻小游戏</h1></div><div class="games-grid"><button v-for="game in games" :key="game.id" class="game-tile" @click="startGame(game)"><h2>{{game.title}}</h2><p>{{game.description}}</p><strong>{{game.kind==='quiz'?'开始游戏':'打开游戏'}}</strong></button></div></section>
  <section v-if="page==='quiz'" class="site-page game-page"><div class="page-heading"><button class="back-link" @click="navigate('games')">← 返回科幻小游戏</button><h1>趣味问答</h1></div><div class="quiz-card" v-if="!finished"><div class="quiz-progress"><span>第 {{step+1}} / 10 题</span><div><i :style="{width:(step/10*100)+'%'}"></i></div></div><h2>{{questions[step].q}}</h2><button v-for="(answer,i) in questions[step].a" :key="answer" class="quiz-option" @click="choose(i)"><span>{{['A','B','C'][i]}}</span>{{answer}}</button></div><div v-else class="quiz-card result"><div class="result-number">{{score}}<small>/ 10</small></div><h2>答题结果</h2><p>答对 {{score}} 道题。下面可以查看每题正确答案。</p><button class="gold-button" @click="restart">再答一次</button><ol><li v-for="(q,i) in questions" :key="i"><b>{{q.q}}</b><span :class="{wrong:answers[i]!==q.c}">你的答案：{{q.a[answers[i]]}}；正确答案：{{q.a[q.c]}}</span></li></ol></div></section>
 </main><footer class="site-footer"><div><b>银杏科幻</b><span>电子科技大学科幻协会</span></div></footer>
</div>
</template>

