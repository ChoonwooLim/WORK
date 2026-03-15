import os
import re

filepath = '/home/stevenlim/WORK/orbitron/public/changelog-en.html'

replacements = [
    (r'가비아,\s*Namecheap\s*등에서\s*구매한\s*도메인을\s*3단계\(DNS\s*검증\s*→\s*Cloudflare\s*터널\s*연결\s*→\s*활성화\)로\s*자동\s*연결합니다\.\s*CNAME\s*레코드만\s*설정하면\s*SSL\s*인증서,\s*리버스\s*프록시,\s*CDN이\s*모두\s*자동\s*적용됩니다\.',
     'Automatically connects domains purchased from Gabia, Namecheap, etc. in 3 steps (DNS Verification → Cloudflare Tunnel Connection → Activation). By just setting the CNAME record, SSL certificates, reverse proxy, and CDN are all automatically applied.'),
     
    (r'가비아,\s*Namecheap,\s*Cloudflare\s*등\s*주요\s*도메인\s*등록기관별\s*CNAME\s*설정\s*가이드를\s*추가했습니다\.\s*향후\s*도메인\s*검색/구매/자동\s*연동\s*기능\(가비아\s*리셀러\s*API,\s*Namecheap\s*API\)의\s*구현\s*로드맵을\s*공개했습니다\.',
     'Added CNAME setup guides for major domain registrars like Gabia, Namecheap, and Cloudflare. Revealed the implementation roadmap for future domain search/purchase/auto-connection features (Gabia Reseller API, Namecheap API).'),
     
    (r'실제\s*봇\s*토큰\s*없이도\s*브라우저\s*내에서\s*완벽한\s*프론트엔드\s*제어를\s*시연할\s*수\s*있도록\s*<b>RemoteAGT</b>\s*대시보드\s*내에\s*모바일\s*텔레그램\s*및\s*카카오톡\s*UI\s*구조를\s*완벽하게\s*모사한\s*웹\s*시뮬레이터를\s*런칭했습니다\.\s*폴링\s*없는\s*실시간\s*SSE\(Server-Sent\s*Events\)\s*비동기\s*파이프라인과\s*Webhook\s*모킹\s*기술을\s*통해\s*매끄러운\s*응답\s*경험을\s*선사합니다\.',
     'Launched a web simulator that perfectly mimics the mobile Telegram and KakaoTalk UI structures within the <b>RemoteAGT</b> dashboard so you can demonstrate perfect frontend control in the browser without an actual bot token. Delivers a seamless response experience through a real-time SSE (Server-Sent Events) asynchronous pipeline without polling and Webhook mocking technology.'),
     
    (r'이제\s*배포\s*진행\s*상황,\s*서버\s*장애\s*모니터링\s*경고\s*등을\s*텔레그램뿐만\s*아니라\s*국내\s*환경에\s*맞춘\s*\'카카오톡\s*오픈빌더\s*스킬\s*연동\'을\s*통하여\s*모바일\s*톡방에서\s*실시간으로\s*수신할\s*수\s*있습니다\.',
     'Now, deployment progress and server failure monitoring warnings can be received in real-time in mobile chat rooms through \'KakaoTalk Open Builder Skill Integration\' tailored for the domestic environment, in addition to Telegram.'),
     
    (r'이제\s*완전히\s*독립된\s*두\s*서비스가\s*물리적인\s*단일\s*PostgreSQL\s*데이터베이스\s*통신망\s*위에서\s*통합되었습니다\.\s*어느\s*쪽에서\s*가입하든\s*<code>\*\.twinverse\.org</code>\s*와일드카드\s*쿠키를\s*통해\s*완벽한\s*크로스\s*호환\s*로그인이\s*가능합니다\.',
     'Now, two completely independent services have been integrated over a single physical PostgreSQL database network. Whichever side you sign up from, fully cross-compatible login is possible through the <code>*.twinverse.org</code> wildcard cookie.'),
     
    (r'가입\s*시\s*활동\s*로그\(<code>ragt_audit_log</code>\)\s*로깅\s*과정에서\s*<code>web_user_id</code>\s*및\s*<code>user_id</code>\s*컬럼\s*부재로\s*발생하던\s*치명적\s*로그인\s*블록\s*버그를\s*완벽히\s*수정\s*및\s*마이그레이션\s*조치했습니다\.',
     'Completely fixed and migrated the critical login block bug that occurred due to the absence of <code>web_user_id</code> and <code>user_id</code> columns during the activity log (<code>ragt_audit_log</code>) logging process upon sign-up.'),
     
    (r'배포\s*시\s*런타임\(Node\.js,\s*Python,\s*Go\s*등\),\s*프레임워크\(FastAPI,\s*Vite,\s*Next\.js\s*등\s*20종\+\),\s*서비스\s*타입,\s*포트,\s*빌드\s*명령어,\s*의존관계를\s*100%\s*자동\s*감지합니다\.\s*orbitron\.yaml\s*없이도\s*완벽한\s*배포가\s*가능합니다\.',
     '100% auto-detects runtimes (Node.js, Python, Go, etc.), frameworks (over 20 types including FastAPI, Vite, Next.js), service types, ports, build commands, and dependencies upon deployment. Perfect deployment is possible even without orbitron.yaml.'),
     
    (r'하나의\s*레포에\s*백엔드,\s*프론트엔드,\s*직원앱\s*등\s*여러\s*서비스를\s*services\s*배열로\s*정의하면\s*각\s*서비스를\s*자동으로\s*올바른\s*타겟\(Docker/CF\s*Pages\)에\s*배포합니다\.\s*<code>from:</code>\s*참조\s*문법으로\s*서비스\s*간\s*URL을\s*자동\s*연결합니다\.',
     'By defining multiple services such as backend, frontend, and staff apps as a services array in a single repository, it automatically deploys each service to the correct target (Docker/CF Pages). Automatically connects URLs between services using the <code>from:</code> reference syntax.'),
     
    (r'<code>type:\s*static</code>\s*서비스를\s*감지하면\s*Cloudflare\s*Pages\s*CDN에\s*자동\s*빌드/배포합니다\.\s*전\s*세계\s*에지\s*네트워크에서\s*초고속으로\s*서빙되며,\s*멀티\s*프론트엔드\s*동시\s*배포도\s*지원합니다\.',
     'When a <code>type: static</code> service is detected, it automatically builds/deploys to the Cloudflare Pages CDN. Served at ultra-high speed from the global edge network, and also supports simultaneous multi-frontend deployments.'),
     
    (r'orbitron\.yaml에\s*<code>postDeploy:</code>\s*배열을\s*정의하여\s*메인\s*배포\s*완료\s*후\s*추가\s*명령어를\s*자동\s*실행합니다\.\s*환경변수\s*주입,\s*3분\s*타임아웃,\s*성공/실패\s*로그\s*기록을\s*지원합니다\.',
     'Defines the <code>postDeploy:</code> array in orbitron.yaml to automatically execute additional commands after the main deployment is complete. Supports environment variable injection, a 3-minute timeout, and success/failure logging.'),
     
    (r'Vite/React\s*정적\s*서비스\s*빌드\s*시\s*<code>VITE_API_URL</code>\s*등\s*환경변수가\s*주입되지\s*않아\s*프로덕션에서\s*localhost로\s*API를\s*요청하던\s*크리티컬\s*버그를\s*수정했습니다\.',
     'Fixed a critical bug where environment variables such as <code>VITE_API_URL</code> were not injected during Vite/React static service builds, causing the production environment to request APIs to localhost.'),
     
    (r'IaC\s*가이드,\s*정적\s*사이트,\s*AI\s*분석기,\s*핵심\s*개념,\s*웹\s*서비스\s*문서에\s*멀티\s*서비스\s*배포,\s*Smart\s*Analyzer,\s*CF\s*Pages\s*자동\s*배포,\s*Error\s*Knowledge\s*DB\s*내용을\s*추가했습니다\.',
     'Added contents on multi-service deployment, Smart Analyzer, CF Pages auto deployment, and Error Knowledge DB to the IaC guide, static sites, AI analyzer, core concepts, and web services docs.'),
     
    (r'신규\s*가입자는\s*자동으로\s*\'Viewer\'\s*등급이\s*부여되어,\s*대시보드\s*메뉴를\s*둘러볼\s*수\s*있지만\s*프로젝트\s*생성·배포·수정은\s*불가합니다\.\s*관리자가\s*등급을\s*승격\(Viewer\s*→\s*User\s*→\s*Admin\)할\s*수\s*있습니다\.',
     'New users are automatically assigned the \'Viewer\' tier, allowing them to browse the dashboard menu but restricting project creation, deployment, and modification. Administrators can promote their tier (Viewer → User → Admin).'),
     
    (r'AI가\s*분석한\s*에러\s*패턴과\s*해결책을\s*자동\s*저장하여,\s*같은\s*에러\s*재발\s*시\s*즉시\s*과거\s*해결책을\s*제안합니다\.\s*시간이\s*지날수록\s*더\s*빠르게\s*문제를\s*해결하는\s*학습형\s*배포\s*플랫폼입니다\.',
     'Automatically saves error patterns and solutions analyzed by AI, instantly suggesting past solutions when the same error recurs. A learning deployment platform that resolves issues faster over time.'),
     
    (r'Docker\s*이미지와\s*빌드\s*캐시를\s*SSD에서\s*HDD로\s*마이그레이션하여\s*SSD\s*디스크\s*공간을\s*최적화했습니다\.\s*사이트\s*성능에\s*영향\s*없이\s*수십\s*GB의\s*공간을\s*확보합니다\.',
     'Optimized SSD disk space by migrating Docker images and build caches from SSD to HDD. Secures tens of GBs of space without affecting site performance.'),
     
    (r'대시보드\s*프로젝트\s*목록에서\s*CPU,\s*메모리,\s*업타임,\s*네트워크\s*I/O를\s*실시간으로\s*확인할\s*수\s*있습니다\.\s*개별\s*페이지\s*진입\s*없이\s*한눈에\s*모든\s*프로젝트를\s*모니터링합니다\.',
     'Check CPU, memory, uptime, and network I/O in real-time from the dashboard project list. Monitor all projects at a glance without entering individual pages.'),
     
    (r'AI\s*채팅\s*기능에서\s*"API\s*key\s*missing"\s*에러와\s*리셋\s*버튼\s*미동작\s*문제를\s*해결했습니다\.\s*기본\s*모델이\s*Claude\s*4\.6\s*Sonnet으로\s*설정됩니다\.',
     'Resolved the "API key missing" error and unresponsive reset button issue in the AI chat feature. The default model is set to Claude 4.6 Sonnet.'),
     
    (r'듀얼\s*GPU\s*로드밸런싱이\s*적용된\s*Unreal\s*Engine\s*Pixel\s*Streaming\s*서버를\s*원클릭\s*배포합니다\.',
     'One-click deployment of an Unreal Engine pixel streaming server applied with dual GPU load balancing.'),
     
    (r"if\s*\(token\s*&&\s*navBtn\)\s*navBtn\.innerHTML\s*=\s*'대시보드\s*관리';", 
     "if (token && navBtn) navBtn.innerHTML = 'Launch Dashboard';")
]

if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for pattern, e in replacements:
        content = re.sub(pattern, e, content)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched {filepath} with regex")
