import re

def rebuild_presentation():
    with open('comparison.html', 'r', encoding='utf-8') as f:
        comp_html = f.read()
        
    # We will just write a hardcoded awesome beautiful flexbox layout for the 4 competitor slides and 1 KPI slide.
    
    new_slides = """
            <!-- 7-3. Global Matrix 1/2 -->
            <section>
                <h2><span class="gradient-blue">Global Top 5</span> PaaS Competitors <span style="font-size:24px; color:#64748b;">(1/2)</span></h2>
                <h3 style="color:#94a3b8; font-weight:400; margin-bottom: 40px;">Part 1 : 핵심 배포 인프라 & CI/CD</h3>
                
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Orbitron -->
                    <div class="glass-card" style="border: 2px solid #3b82f6; background: rgba(59, 130, 246, 0.05) !important;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin:0; font-size: 36px; color: #fff;">🪐 Orbitron</h3>
                            <div style="font-size: 24px; color: #10b981; font-weight: 700;">ALL PASSED (100%)</div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px;">
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">CI/CD 배포</div>
                                <div style="color:#10b981; font-size: 24px; font-weight: bold;">✔ 완벽 지원</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">풀스택 모노리포</div>
                                <div style="color:#10b981; font-size: 24px; font-weight: bold;">✔ 엔진 내장</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">매니지드 DB</div>
                                <div style="color:#10b981; font-size: 24px; font-weight: bold;">✔ 자동 백업</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">Docker Compose</div>
                                <div style="color:#10b981; font-size: 24px; font-weight: bold;">✔ 완벽 지원</div>
                            </div>
                        </div>
                    </div>

                    <!-- Vercel -->
                    <div class="glass-card" style="opacity: 0.8;">
                        <h3 style="margin:0 0 20px 0; font-size: 28px; color: #fff;">▲ Vercel</h3>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                            <div><span style="color:#10b981;">✔ 지원</span> <br><span style="font-size:14px; color:#64748b;">(CI/CD)</span></div>
                            <div><span style="color:#f59e0b;">△ 제한적</span> <br><span style="font-size:14px; color:#64748b;">(프론트 위주)</span></div>
                            <div><span style="color:#10b981;">✔ 지원</span> <br><span style="font-size:14px; color:#64748b;">(Vercel DB)</span></div>
                            <div><span style="color:#ef4444;">✘ 미지원</span> <br><span style="font-size:14px; color:#64748b;">(Docker)</span></div>
                        </div>
                    </div>

                    <!-- Heroku -->
                    <div class="glass-card" style="opacity: 0.8;">
                        <h3 style="margin:0 0 20px 0; font-size: 28px; color: #fff;">🟣 Heroku</h3>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                            <div><span style="color:#10b981;">✔ 지원</span> <br><span style="font-size:14px; color:#64748b;">(CI/CD)</span></div>
                            <div><span style="color:#10b981;">✔ 지원</span> <br><span style="font-size:14px; color:#64748b;">(풀스택)</span></div>
                            <div><span style="color:#10b981;">✔ 지원</span> <br><span style="font-size:14px; color:#64748b;">(Heroku Postgres)</span></div>
                            <div><span style="color:#f59e0b;">△ 제한적</span> <br><span style="font-size:14px; color:#64748b;">(heroku.yml)</span></div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- 7-4. Global Matrix 2/2 -->
            <section>
                <h2><span class="gradient-blue">Global Top 5</span> PaaS Competitors <span style="font-size:24px; color:#64748b;">(2/2)</span></h2>
                <h3 style="color:#94a3b8; font-weight:400; margin-bottom: 40px;">Part 2 : 글로벌 네트워크 & 고성능 AI 제어</h3>
                
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Orbitron -->
                    <div class="glass-card" style="border: 2px solid #3b82f6; background: rgba(59, 130, 246, 0.05) !important;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin:0; font-size: 36px; color: #fff;">🪐 Orbitron</h3>
                            <div style="font-size: 24px; color: #10b981; font-weight: 700;">NEXT-GEN ARCHITECTURE</div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px;">
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">Edge CDN 방어</div>
                                <div style="color:#10b981; font-size: 22px; font-weight: bold;">✔ 최고등급 (CF)</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">AI 에러진단 (RAG)</div>
                                <div style="color:#10b981; font-size: 22px; font-weight: bold;">✔ Gemini 내장</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">모바일 텔레그램 제어</div>
                                <div style="color:#10b981; font-size: 22px; font-weight: bold;">✔ RemoteAGT</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">3D Pixel Streaming</div>
                                <div style="color:#10b981; font-size: 22px; font-weight: bold;">✔ Unreal 네이티브</div>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                        <!-- Vercel -->
                        <div class="glass-card" style="opacity: 0.8;">
                            <h3 style="margin:0 0 15px 0; font-size: 24px; color: #fff;">▲ Vercel</h3>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                                <div><span style="color:#10b981;">✔ CDN</span></div>
                                <div><span style="color:#f59e0b;">△ v0 (UI 위주)</span></div>
                                <div><span style="color:#ef4444;">✘ 모바일 챗봇 제어</span></div>
                                <div><span style="color:#ef4444;">✘ 3D 엔진 미지원</span></div>
                            </div>
                        </div>

                        <!-- Heroku -->
                        <div class="glass-card" style="opacity: 0.8;">
                            <h3 style="margin:0 0 15px 0; font-size: 24px; color: #fff;">🟣 Heroku</h3>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                                <div><span style="color:#ef4444;">✘ CDN 부재</span></div>
                                <div><span style="color:#ef4444;">✘ AI 미지원</span></div>
                                <div><span style="color:#ef4444;">✘ 메신저 제어</span></div>
                                <div><span style="color:#ef4444;">✘ 무거운 엔진 불가</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            <!-- 7-5. Domestic Matrix -->
            <section>
                <h2><span class="gradient-green">Domestic Top 5</span> Cloud Competitors</h2>
                <h3 style="color:#94a3b8; font-weight:400; margin-bottom: 40px;">국내 주요 웹호스팅 및 IaaS 클라우드사 비교</h3>
                
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Orbitron -->
                    <div class="glass-card" style="border: 2px solid #10b981; background: rgba(16, 185, 129, 0.05) !important;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin:0; font-size: 36px; color: #fff;">🪐 Orbitron</h3>
                            <div style="font-size: 24px; color: #10b981; font-weight: 700;">독보적 자동화 수준</div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px;">
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">Git 자동 배포</div>
                                <div style="color:#10b981; font-size: 24px; font-weight: bold;">✔ 1-Click</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">Docker Compose</div>
                                <div style="color:#10b981; font-size: 24px; font-weight: bold;">✔ 네이티브</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">무료 SSL 발급</div>
                                <div style="color:#10b981; font-size: 24px; font-weight: bold;">✔ 오토매틱</div>
                            </div>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <div style="color:#94a3b8; font-size: 16px; margin-bottom: 5px;">AI 장애 복구</div>
                                <div style="color:#10b981; font-size: 24px; font-weight: bold;">✔ 유일무이</div>
                            </div>
                        </div>
                    </div>

                    <!-- Domestic 1 -->
                    <div class="glass-card" style="opacity: 0.8;">
                        <h3 style="margin:0 0 20px 0; font-size: 28px; color: #fff;">☕ Cafe24 (호스팅)</h3>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                            <div><span style="color:#ef4444;">✘ 수동 FTP</span></div>
                            <div><span style="color:#f59e0b;">△ 복잡한 세팅</span></div>
                            <div><span style="color:#f59e0b;">△ 유료 구매</span></div>
                            <div><span style="color:#ef4444;">✘ AI 전무</span></div>
                        </div>
                    </div>

                    <!-- Domestic 2 -->
                    <div class="glass-card" style="opacity: 0.8;">
                        <h3 style="margin:0 0 20px 0; font-size: 28px; color: #fff;">🟢 Naver Cloud (IaaS)</h3>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                            <div><span style="color:#f59e0b;">△ 자체 DevOps 요망</span></div>
                            <div><span style="color:#10b981;">✔ K8s 지원</span></div>
                            <div><span style="color:#f59e0b;">△ 유료 로드밸런서</span></div>
                            <div><span style="color:#ef4444;">✘ AI 복구 전무</span></div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- 7-6. KPI Dashboard (10-Year Projections) -->
            <section>
                <h2><span class="gradient-purple">10-Year Financial Dashboard</span></h2>
                <p style="font-size: 24px; margin-bottom: 50px;">J-Curve Hyper-Growth : 단 2년 차 분기 흑자 달성 및 SaaS 영업이익률 60% 달성 구조</p>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 30px;">
                    <!-- Year 1 -->
                    <div class="glass-card" style="text-align: center; padding: 40px 20px;">
                        <h3 style="color: #94a3b8; font-size: 24px; margin-bottom: 30px;">Year 1 (2026)</h3>
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">ARR (반복매출)</div>
                            <div style="font-size: 48px; font-weight: 800; color: #fff;">$2.5M</div>
                        </div>
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">OPEX (영업비용)</div>
                            <div style="font-size: 32px; font-weight: 700; color: #f87171;">$2.5M</div>
                        </div>
                        <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">EBITDA</div>
                            <div style="font-size: 36px; font-weight: 900; color: #ef4444;">-$1.5M</div>
                        </div>
                    </div>

                    <!-- Year 3 -->
                    <div class="glass-card" style="text-align: center; padding: 40px 20px; border-top: 4px solid #3b82f6;">
                        <h3 style="color: #94a3b8; font-size: 24px; margin-bottom: 30px;">Year 3 <span style="color:#3b82f6">(Scale-up)</span></h3>
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">ARR (반복매출)</div>
                            <div style="font-size: 48px; font-weight: 800; color: #fff;">$85M</div>
                        </div>
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">Growth Rate</div>
                            <div style="font-size: 32px; font-weight: 700; color: #3b82f6;">372%</div>
                        </div>
                        <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">EBITDA</div>
                            <div style="font-size: 36px; font-weight: 900; color: #10b981;">+$18M</div>
                        </div>
                    </div>

                    <!-- Year 5 -->
                    <div class="glass-card" style="text-align: center; padding: 40px 20px; border-top: 4px solid #8b5cf6;">
                        <h3 style="color: #94a3b8; font-size: 24px; margin-bottom: 30px;">Year 5 <span style="color:#8b5cf6">(Unicorn)</span></h3>
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">ARR (반복매출)</div>
                            <div style="font-size: 56px; font-weight: 800; color: #fff;">$350M</div>
                        </div>
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">Gross Margin</div>
                            <div style="font-size: 32px; font-weight: 700; color: #8b5cf6;">74%</div>
                        </div>
                        <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">EBITDA</div>
                            <div style="font-size: 36px; font-weight: 900; color: #10b981;">+$74M</div>
                        </div>
                    </div>

                    <!-- Year 10 -->
                    <div class="glass-card" style="text-align: center; padding: 40px 20px; border: 2px solid #10b981; background: rgba(16,185,129,0.05) !important;">
                        <h3 style="color: #94a3b8; font-size: 24px; margin-bottom: 30px;">Year 10 <span style="color:#10b981">(IPO Ready)</span></h3>
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">ARR (반복매출)</div>
                            <div style="font-size: 64px; font-weight: 800; color: #10b981;">$4.5B</div>
                        </div>
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">EBITDA Margin</div>
                            <div style="font-size: 32px; font-weight: 700; color: #10b981;">60%</div>
                        </div>
                        <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 16px; color: #64748b; text-transform: uppercase;">EBITDA</div>
                            <div style="font-size: 42px; font-weight: 900; color: #10b981;">+$2.7B</div>
                        </div>
                    </div>
                </div>
            </section>
"""

    with open('presentation.html', 'r', encoding='utf-8') as f:
        pres_html = f.read()

    # We need to wipe out the old slides from <!-- 7-3. Global Table --> down to <!-- 8. Target Market -->
    start_str = "<!-- 7-3. Global Table -->"
    end_str = "<!-- 8. Target Market -->"
    
    start_idx = pres_html.find(start_str)
    
    # If standard markers are missing, try to find Domestic Table start
    if start_idx == -1:
        start_idx = pres_html.find("<!-- 7-4. Domestic Table -->")
        if start_idx == -1:
             start_idx = pres_html.find("<h2><span class=\"gradient-green\">Domestic Top 5</span> Cloud Competitors</h2>") - 100

    end_idx = pres_html.find(end_str)
    
    if start_idx != -1 and end_idx != -1:
        pres_html = pres_html[:start_idx] + new_slides + "\n\n" + pres_html[end_idx:]
        
        with open('presentation.html', 'w', encoding='utf-8') as f:
            f.write(pres_html)
        print("Successfully rebuilt presentation with infographic slides.")
    else:
        print(f"Could not find markers. start: {start_idx}, end: {end_idx}")

if __name__ == '__main__':
    rebuild_presentation()
