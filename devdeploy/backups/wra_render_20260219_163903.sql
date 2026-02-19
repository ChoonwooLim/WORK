--
-- PostgreSQL database dump
--

\restrict YcZEhUAWul6stE3XCGhYvl3Up7c9rKrQIDMzHMMn791QyeygXdmhdlrhNiSzeC0

-- Dumped from database version 18.1 (Debian 18.1-1.pgdg12+2)
-- Dumped by pg_dump version 18.2 (Ubuntu 18.2-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


--
-- Name: Post; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Post" (
    id text NOT NULL,
    board text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text,
    views integer DEFAULT 0 NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    answered boolean DEFAULT false NOT NULL,
    "authorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text,
    email text,
    "emailVerified" timestamp(3) without time zone,
    image text,
    password text,
    role text DEFAULT 'student'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- Data for Name: Post; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Post" (id, board, title, content, category, views, likes, answered, "authorId", "createdAt", "updatedAt") FROM stdin;
cmljfqugj0001yewo1e6558iu	notices	세계왕립아카데미 2026년 상반기 교육과정 안내	안녕하세요, 세계왕립아카데미입니다.\n\n2026년 상반기 교육과정을 안내드립니다.\n\n1. K-Culture 교육 프로그램 (3월~6월)\n   - 한국어 교육 과정 (초급/중급/고급)\n   - 한국 전통문화 체험 프로그램\n   - K-Pop & K-Drama 문화 이해 과정\n\n2. CEO 특별 프로그램 (4월~5월)\n   - 글로벌 리더십 워크숍\n   - 한국 비즈니스 문화 이해\n   - 네트워킹 세션\n\n3. 왕립 인문학 강좌 (3월~7월)\n   - 대한제국 역사와 문화유산\n   - 동아시아 왕실 비교 연구\n   - 현대 한국의 문화적 정체성\n\n자세한 일정과 등록 방법은 교육 페이지를 참고해주세요.\n감사합니다.	교육	489	0	f	cml9kx6340000fr3x7qkqyfo5	2026-02-12 12:29:03.283	2026-02-12 12:29:03.283
cmljfquqx0003yewo04ywbfv4	notices	The Royal 33 제2기 멤버 모집 안내	The Royal 33 제2기 멤버를 모집합니다.\n\n■ 모집 기간: 2026년 2월 10일 ~ 3월 15일\n■ 모집 인원: 33명\n■ 자격 요건:\n  - 각 분야에서 5년 이상 경력을 보유한 전문가\n  - 한국 문화와 글로벌 비즈니스에 관심이 있는 분\n  - WRA 회원 가입 필수\n\n■ 혜택:\n  - K-Royal Warrant 인증 우선 심사\n  - 글로벌 네트워크 참여 기회\n  - 왕립 투어 프로그램 우선 참여\n  - 연간 갈라 디너 초대\n\n■ 지원 방법: 인증 페이지에서 온라인 지원서 제출\n\n많은 관심과 지원 부탁드립니다.	인증	312	0	f	cml9kx6340000fr3x7qkqyfo5	2026-02-12 12:29:03.657	2026-02-12 12:29:03.657
cmljfqut20005yewox17d4w2g	notices	황태손 전하 인도네시아 문화교류 활동 보고	지난 1월 10일~14일, 황태손 전하께서 인도네시아 자카르타를 방문하여 문화교류 활동을 진행하셨습니다.\n\n주요 활동 내역:\n\n1. 자카르타 한국문화원 방문 및 특별 강연\n2. 인도네시아 왕실 후손과의 문화 교류 만찬\n3. K-Culture 교육센터 개소식 참석\n4. 현지 한인 커뮤니티 간담회\n5. 인도네시아 전통문화 체험 및 교류\n\n이번 방문을 통해 한-인도네시아 문화 교류의 새로운 장이 열렸으며, 향후 정기적인 교류 프로그램을 운영할 예정입니다.\n\n자세한 활동 보고서는 추후 공개될 예정입니다.	활동	234	0	f	cml9kx6340000fr3x7qkqyfo5	2026-02-12 12:29:03.735	2026-02-12 12:29:03.735
cmljfquxc0009yewoq4gvvmpm	notices	왕립 투어 프로그램 일정 업데이트	2026년 상반기 왕립 투어 프로그램 일정을 안내드립니다.\n\n🏯 서울 궁궐 투어 (매월 첫째 주 토요일)\n  - 경복궁, 창덕궁, 덕수궁 순례\n  - 전문 해설사 동행\n  - 전통 의상 체험 포함\n\n🎎 전통문화 체험 투어 (매월 둘째 주 토요일)\n  - 한옥마을 방문\n  - 전통 공예 체험\n  - 한정식 만찬\n\n✈️ 해외 왕실 교류 투어 (분기별)\n  - 3월: 일본 교토 (황실 유적 탐방)\n  - 6월: 영국 런던 (버킹엄궁 방문)\n\n■ 예약 방법: 서비스 > 왕립 투어 페이지에서 신청\n■ 참가비: 회원 등급별 차등 적용\n\n많은 참여 부탁드립니다.	투어	156	0	f	cml9kx6340000fr3x7qkqyfo5	2026-02-12 12:29:03.889	2026-02-12 12:29:03.889
cmljfqv3r000dyewo6nu5gj4x	qna	K-Royal Warrant 인증을 받으려면 어떤 조건이 필요한가요?	K-Royal Warrant 인증에 관심이 있는 중소기업 대표입니다.\n\n인증을 받기 위한 구체적인 자격 요건과 절차를 알고 싶습니다.\n특히 다음 사항이 궁금합니다:\n\n1. 업종 제한이 있나요?\n2. 최소 사업 경력 요건이 있나요?\n3. 심사 비용은 얼마인가요?\n4. 인증 유효기간은 어떻게 되나요?\n\n답변 부탁드립니다.	\N	156	0	t	cml9kus780000cijwsahwbd34	2026-02-12 12:29:04.12	2026-02-12 12:29:04.12
cmljfqv81000fyewocywrhsba	qna	The Royal 33 멤버십 자격요건이 궁금합니다	The Royal 33이라는 프로그램을 알게 되었는데, 구체적인 자격요건이 궁금합니다.\n\n현재 IT 분야에서 7년차 개발자로 일하고 있고, 한국 문화에 관심이 많습니다.\n제 경우에도 지원이 가능한지, 선발 기준은 무엇인지 알고 싶습니다.\n\n감사합니다.	\N	203	0	f	cml9kus780000cijwsahwbd34	2026-02-12 12:29:04.274	2026-02-12 12:29:04.274
cmljfqveu000lyewocbg0hld9	free-board	WRA 커뮤니티에 오신 것을 환영합니다!	안녕하세요, 세계왕립아카데미(WRA) 커뮤니티에 오신 것을 환영합니다! 🎉\n\n이 곳은 WRA 회원 여러분이 자유롭게 소통하고 정보를 나누는 공간입니다.\n\n📌 커뮤니티 이용 안내:\n- 서로를 존중하는 매너를 지켜주세요\n- 유익한 정보와 경험을 공유해주세요\n- 궁금한 점은 Q&A 게시판을 이용해주세요\n- 부적절한 게시물은 관리자에 의해 삭제될 수 있습니다\n\n함께 성장하는 커뮤니티를 만들어가겠습니다.\n감사합니다!	\N	567	32	f	cml9kx6340000fr3x7qkqyfo5	2026-02-12 12:29:04.518	2026-02-12 12:29:04.518
cmljfqva5000hyewo8vxyppyd	qna	교육 프로그램은 온라인으로 참여할 수 있나요?	해외에 거주하고 있어서 직접 방문이 어려운데,\n교육 프로그램을 온라인으로 참여할 수 있는지 궁금합니다.\n\n특히 한국어 교육과 한국 문화 강좌에 관심이 있습니다.\n온라인 과정이 있다면 수강료와 일정도 알려주세요.\n\n감사합니다.	\N	80	0	t	cml9kus780000cijwsahwbd34	2026-02-12 12:29:04.349	2026-02-12 12:34:54.941
cmljfqvcn000jyewo24f21dxs	qna	디지털 씰 인증서 발급 기간은 어느 정도인가요?	K-Royal Warrant 인증을 신청하고 디지털 씰 인증서를 발급받으려고 합니다.\n\n신청 후 발급까지 소요기간이 궁금하고,\n발급된 인증서는 어떤 형태로 제공되는지 알고 싶습니다.\n\n블록체인 기반이라고 들었는데, 일반인도 진위 확인이 가능한 건가요?\n\n답변 부탁드립니다.	\N	69	0	f	cml9kus780000cijwsahwbd34	2026-02-12 12:29:04.44	2026-02-12 12:35:01.326
cmljfquze000byewo7w1lzydq	qna	WRA 회원가입은 어떻게 하나요?	안녕하세요, WRA에 관심이 생겨서 회원가입을 하고 싶은데요.\n\n회원가입 절차와 필요한 서류가 있는지 궁금합니다.\n또한 회원 등급은 어떻게 나뉘는지도 알고 싶습니다.\n\n감사합니다.	\N	91	0	t	cml9kus780000cijwsahwbd34	2026-02-12 12:29:03.962	2026-02-12 12:35:09.254
cmljfqvh3000nyewotur6ewxe	free-board	왕립 투어 후기 — 경복궁 야간 특별 관람	지난 주말 WRA 왕립 투어에 참여했는데 정말 감동적이었습니다.\n\n특히 경복궁 야간 특별 관람이 인상 깊었는데요,\n조명으로 물든 궁궐의 야경이 정말 아름다웠습니다.\n\n전문 해설사 분의 설명도 너무 좋았고,\n조선 왕실의 일상을 생생하게 느낄 수 있었습니다.\n\n한복을 입고 궁궐을 거니는 체험도 특별했어요.\n다음 투어도 꼭 참여하고 싶습니다!\n\n📸 사진은 나중에 올려볼게요~\n\n추천 포인트:\n- 야간 관람은 분위기가 정말 다름\n- 해설사 분의 스토리텔링이 최고\n- 한복 체험은 필수!	\N	189	23	f	cml9kus780000cijwsahwbd34	2026-02-12 12:29:04.6	2026-02-12 12:29:04.6
cmljfqvoc000pyewov7mbu4ax	free-board	K-Culture 교육 프로그램 참여 후기 공유합니다	3주간의 K-Culture 교육 프로그램을 수료했습니다!\n\n프로그램 구성:\n1주차: 한국어 기초 + 한글 서예 체험\n2주차: 한국 전통 음식 만들기 + 다도 체험\n3주차: K-Pop 댄스 + 한국 현대문화 세미나\n\n가장 인상 깊었던 것은 한글 서예 체험이었어요.\n붓으로 한글을 쓰는 것이 이렇게 아름다울 수 있다니...\n\n같은 조 멤버들과도 친해져서 아직도 연락하고 있어요.\n다음 기수에 관심 있으신 분들은 교육 페이지 확인해보세요!\n\n꼭 추천드립니다 👍	\N	145	18	f	cml9kus780000cijwsahwbd34	2026-02-12 12:29:04.861	2026-02-12 12:29:04.861
cmljfqvrn000ryewoeji6t1zu	free-board	Royal 33 멤버들의 네트워킹 행사 정보 모음	안녕하세요, Royal 33 1기 멤버입니다.\n\n다가오는 네트워킹 행사 정보를 정리해서 공유합니다.\n\n📅 3월 행사:\n- 3/8(토) 서울 강남 라운지 모임 (7pm~)\n- 3/15(토) 온라인 줌 세미나: "글로벌 비즈니스 트렌드"\n- 3/22(토) 부산 지역 멤버 모임\n\n📅 4월 행사:\n- 4/5(토) 글로벌 리더십 컨퍼런스 (코엑스)\n- 4/12(토) 문화 탐방: 수원 화성\n- 4/19(토) 온라인 멘토링 세션\n\n참가 신청은 카카오톡 공지를 확인해주세요.\n비회원도 일부 행사에 참가 가능하니 관심 있으시면 문의주세요!\n\n#Royal33 #네트워킹 #일정공유	\N	312	41	f	cml9kus780000cijwsahwbd34	2026-02-12 12:29:04.979	2026-02-12 12:29:04.979
cmljfqvto000tyewopp9ti57f	free-board	2026년 상반기 행사 일정 정리해봤습니다	여러 공지사항에 흩어져 있는 행사 일정을 한눈에 보기 쉽게 정리해봤습니다.\n\n🗓️ 2월\n- 2/21 K-Royal Warrant 인증 설명회\n- 2/28 The Royal 33 제2기 모집 마감\n\n🗓️ 3월\n- 3/1 상반기 교육과정 개강\n- 3/8 궁궐 투어 (경복궁)\n- 3/15 CEO 프로그램 설명회\n\n🗓️ 4월\n- 4/5 글로벌 리더십 컨퍼런스\n- 4/12 전통문화 체험 투어\n- 4/19 해외 왕실 교류: 일본 교토\n\n🗓️ 5월\n- 5/3 궁궐 투어 (창덕궁)\n- 5/17 Royal 33 연례 갈라 디너\n\n🗓️ 6월\n- 6/7 해외 왕실 교류: 영국 런던\n- 6/21 상반기 수료식\n\n변경 사항이 있으면 댓글로 알려주세요!	\N	423	28	f	cml9kus780000cijwsahwbd34	2026-02-12 12:29:05.052	2026-02-12 12:29:05.052
cmljfquv80007yewoss7js8b7	notices	K-Royal Warrant 인증 절차 개선 공지	K-Royal Warrant 인증 절차가 개선되었습니다.\n\n■ 주요 변경 사항:\n\n1. 온라인 신청 시스템 도입\n   - 기존 서류 접수 → 온라인 접수로 변경\n   - 신청서 작성부터 결과 확인까지 원스톱 처리\n\n2. 심사 기간 단축\n   - 기존 60일 → 30일로 단축\n   - 1차 서류심사, 2차 현장심사, 3차 최종심사\n\n3. 디지털 인증서 발급\n   - 블록체인 기반 디지털 씰 인증서 발급\n   - QR코드를 통한 진위 확인 가능\n\n4. 연간 갱신 제도 도입\n   - 매년 간소화된 갱신 절차 진행\n   - 우수 인증 기업 자동 갱신 혜택\n\n문의사항은 Q&A 게시판이나 고객센터로 연락 부탁드립니다.	인증	191	0	f	cml9kx6340000fr3x7qkqyfo5	2026-02-12 12:29:03.812	2026-02-12 12:36:13.469
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, name, email, "emailVerified", image, password, role, "createdAt", "updatedAt") FROM stdin;
cml9kus780000cijwsahwbd34	Steven Lim	choonwoo49@gmail.com	\N	\N	$2b$10$idkO2TaFPkprzy/CBfu/E.ISFkixpWXU4JscbcPTaGkkuHdQOAdgO	student	2026-02-05 14:54:23.3	2026-02-05 14:54:23.3
cml9kx6340000fr3x7qkqyfo5	Admin User	admin@wra.com	\N	\N	$2b$10$7.1N2QLlpBy.vw.fXg45/OuxJYKFXLCOdlqlLpTaE0NyQWfux3isK	admin	2026-02-05 14:56:14.608	2026-02-12 12:06:15.35
\.


--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
5447193e-e7c8-4a30-a4a4-156e3651cc0d	4f1aab6a139779ad10e38cad19880873338a73c8658845199bc35660d0d382bd	2026-02-05 14:49:00.271309+00	20260205144404_init	\N	\N	2026-02-05 14:48:59.897098+00	1
\.


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Post Post_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Post"
    ADD CONSTRAINT "Post_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: Post_authorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Post_authorId_idx" ON public."Post" USING btree ("authorId");


--
-- Name: Post_board_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Post_board_idx" ON public."Post" USING btree (board);


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Post Post_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Post"
    ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict YcZEhUAWul6stE3XCGhYvl3Up7c9rKrQIDMzHMMn791QyeygXdmhdlrhNiSzeC0

