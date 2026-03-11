import re

with open('/home/stevenlim/WORK/orbitron/public/comparison.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add to Global Table
global_target = """                    <tr class="cat-header">
                        <td>엔터프라이즈 & 특수 환경</td>"""

global_addition = """                    <tr class="cat-header">
                        <td>확장 서비스 & 플랫폼 생태계</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Serverless Functions (FaaS)</td>
                        <td class="td-orbitron"><span class="cross">✘ (상시 컨테이너 기반)</span></td>
                        <td><span class="check">✔ (Edge/Serverless)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="check">✔ (Edge Functions)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>
                    <tr>
                        <td>Managed Redis / In-Memory Cache</td>
                        <td class="td-orbitron"><span class="cross">✘ (직접 컨테이너 구동 요망)</span></td>
                        <td><span class="check">✔ (KV/Redis)</span></td>
                        <td><span class="check">✔ (Heroku Data)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="check">✔ (Managed Redis)</span></td>
                        <td><span class="check">✔ (Upstash 연동)</span></td>
                    </tr>
                    <tr>
                        <td>내장 Object Storage (S3 호환)</td>
                        <td class="td-orbitron"><span class="cross">✘ (외부 스토리지 연동 요망)</span></td>
                        <td><span class="check">✔ (Vercel Blob)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="check">✔ (Netlify Blobs)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>

                    <tr class="cat-header">
                        <td>엔터프라이즈 & 특수 환경</td>"""

# Add to Domestic Table
domestic_target = """                    <tr class="cat-header">
                        <td>엔터프라이즈 & 특수 환경</td>"""

# We need to distinguish between the two tables.
# The global table has "<td>엔터프라이즈 & 특수 환경</td>" with 7 <td>s total (including td-orbitron).
# Let's replace the first occurrence (Global) then the second occurrence (Domestic).

parts = html.split('<tr class="cat-header">\n                        <td>엔터프라이즈 & 특수 환경</td>')

domestic_addition = """<tr class="cat-header">
                        <td>확장 서비스 & 플랫폼 생태계</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Serverless Functions (FaaS)</td>
                        <td class="td-orbitron"><span class="cross">✘ (상시 컨테이너 기반)</span></td>
                        <td><span class="check">✔ (Cloud Functions)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>
                    <tr>
                        <td>Managed Redis / In-Memory Cache</td>
                        <td class="td-orbitron"><span class="cross">✘ (직접 컨테이너 구동 요망)</span></td>
                        <td><span class="check">✔ (Cloud DB for Redis)</span></td>
                        <td><span class="check">✔ (Enterprise Redis)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="check">✔ (EasyCache)</span></td>
                        <td><span class="check">✔ (Redis)</span></td>
                    </tr>
                    <tr>
                        <td>내장 Object Storage (S3 호환)</td>
                        <td class="td-orbitron"><span class="cross">✘ (외부 스토리지 연동 요망)</span></td>
                        <td><span class="check">✔ (Object Storage)</span></td>
                        <td><span class="check">✔ (Cloud Storage)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="check">✔ (Object Storage)</span></td>
                        <td><span class="check">✔ (Object Storage)</span></td>
                    </tr>

                    <tr class="cat-header">
                        <td>엔터프라이즈 & 특수 환경</td>"""

if len(parts) == 3:
    new_html = parts[0] + global_addition[20:] + parts[1] + domestic_addition + parts[2]
    with open('/home/stevenlim/WORK/orbitron/public/comparison.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
    print("Tables updated with missing features.")
else:
    print("Could not find the target sections reliably.")
