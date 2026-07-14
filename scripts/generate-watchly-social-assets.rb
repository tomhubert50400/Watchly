require 'base64'
require 'fileutils'

ROOT = File.expand_path('..', __dir__)
SHOTS = File.join(ROOT, 'screenshots/redesign-implementation')
OUT = File.join(ROOT, 'social-assets/twitter')
FileUtils.mkdir_p(OUT)

RASPBERRY = '#DF3A62'
PINK = '#FFADC2'
BG = '#070A11'
SURFACE = '#111722'
TEXT = '#F6F7FB'
MUTED = '#929BAD'

def data_uri(path)
  "data:image/png;base64,#{Base64.strict_encode64(File.binread(path))}"
end

def phone(x, y, w, h, image, rotate: 0, shadow: true)
  filter = shadow ? 'filter="url(#shadow)"' : ''
  <<~SVG
    <g transform="translate(#{x} #{y}) rotate(#{rotate} #{w/2.0} #{h/2.0})" #{filter}>
      <rect width="#{w}" height="#{h}" rx="#{w*0.115}" fill="#05070c" stroke="#303746" stroke-width="4"/>
      <clipPath id="clip#{x.to_i}#{y.to_i}"><rect x="8" y="8" width="#{w-16}" height="#{h-16}" rx="#{w*0.095}"/></clipPath>
      <image href="#{image}" x="8" y="8" width="#{w-16}" height="#{h-16}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip#{x.to_i}#{y.to_i})"/>
    </g>
  SVG
end

def defs
  <<~SVG
  <defs>
    <radialGradient id="glow" cx="70%" cy="20%" r="85%"><stop offset="0" stop-color="#4C1730"/><stop offset="0.45" stop-color="#12101B"/><stop offset="1" stop-color="#070A11"/></radialGradient>
    <linearGradient id="rasp" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FF6A8D"/><stop offset="1" stop-color="#C91F4A"/></linearGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="28" stdDeviation="26" flood-color="#000" flood-opacity="0.7"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="70"/></filter>
  </defs>
  SVG
end

def svg(w, h, body)
  <<~SVG
  <svg xmlns="http://www.w3.org/2000/svg" width="#{w}" height="#{h}" viewBox="0 0 #{w} #{h}">
  #{defs}
  #{body}
  </svg>
  SVG
end

def save(name, w, h, body)
  File.write(File.join(OUT, "#{name}.svg"), svg(w, h, body))
end

home = data_uri(File.join(SHOTS, '01-home.png'))
explore = data_uri(File.join(SHOTS, '02-explore.png'))
detail = data_uri(File.join(SHOTS, '03-detail-hero-fade-fixed.png'))
library = data_uri(File.join(SHOTS, '04-library.png'))
profile = data_uri(File.join(SHOTS, '05-profile.png'))
rating = data_uri(File.join(SHOTS, '07-rating-review.png'))

save('01-intro', 1600, 900, <<~SVG)
  <rect width="1600" height="900" fill="url(#glow)"/>
  <circle cx="1260" cy="150" r="250" fill="#DF3A62" opacity=".16" filter="url(#soft)"/>
  <text x="110" y="180" fill="#{PINK}" font-family="SF Pro Display,Arial" font-size="31" font-weight="700" letter-spacing="5">MEET WATCHLY</text>
  <text x="105" y="305" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="78" font-weight="800">Your watch life.</text>
  <text x="105" y="395" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="72" font-weight="800">Beautifully organized.</text>
  <text x="112" y="510" fill="#{MUTED}" font-family="SF Pro Text,Arial" font-size="34">Discover. Track. Rate. Share.</text>
  <rect x="110" y="585" width="350" height="78" rx="39" fill="url(#rasp)"/>
  <text x="285" y="636" text-anchor="middle" fill="white" font-family="SF Pro Display,Arial" font-size="29" font-weight="750">Built for movie lovers</text>
  #{phone(1120, 60, 360, 780, home, rotate: 7)}
  #{phone(865, 190, 310, 670, explore, rotate: -7)}
SVG

save('02-discover-track', 1600, 900, <<~SVG)
  <rect width="1600" height="900" fill="#{BG}"/>
  <rect x="0" y="0" width="1600" height="12" fill="url(#rasp)"/>
  <text x="115" y="150" fill="#{PINK}" font-family="SF Pro Display,Arial" font-size="28" font-weight="750" letter-spacing="4">DISCOVER &amp; TRACK</text>
  <text x="110" y="260" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="75" font-weight="800">Everything you watch,</text>
  <text x="110" y="342" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="75" font-weight="800">all in one place.</text>
  <g transform="translate(120 455)">
    <circle cx="20" cy="16" r="9" fill="#{RASPBERRY}"/><text x="50" y="28" fill="#{MUTED}" font-family="SF Pro Text,Arial" font-size="31">Trending films and series</text>
    <circle cx="20" cy="92" r="9" fill="#{RASPBERRY}"/><text x="50" y="104" fill="#{MUTED}" font-family="SF Pro Text,Arial" font-size="31">Progress, collections and lists</text>
    <circle cx="20" cy="168" r="9" fill="#{RASPBERRY}"/><text x="50" y="180" fill="#{MUTED}" font-family="SF Pro Text,Arial" font-size="31">A cinematic dark interface</text>
  </g>
  #{phone(980, 85, 300, 650, explore, rotate: -5)}
  #{phone(1230, 165, 300, 650, library, rotate: 5)}
SVG

save('03-rate-share', 1600, 900, <<~SVG)
  <rect width="1600" height="900" fill="url(#glow)"/>
  <text x="105" y="155" fill="#{PINK}" font-family="SF Pro Display,Arial" font-size="29" font-weight="750" letter-spacing="4">YOUR TASTE, YOUR STORY</text>
  <text x="100" y="275" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="78" font-weight="800">Rate what you love.</text>
  <text x="100" y="360" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="78" font-weight="800">Share what you think.</text>
  <text x="108" y="475" fill="#{MUTED}" font-family="SF Pro Text,Arial" font-size="33">Half-star ratings, written reviews,</text>
  <text x="108" y="520" fill="#{MUTED}" font-family="SF Pro Text,Arial" font-size="33">public opinions — private history.</text>
  <g transform="translate(110 625)"><text fill="#{RASPBERRY}" font-family="Arial" font-size="44">★★★★★</text><text x="0" y="70" fill="#{TEXT}" font-family="SF Pro Text,Arial" font-size="26" font-weight="700">Made for real cinephiles</text></g>
  #{phone(1010, 55, 330, 715, detail, rotate: -6)}
  #{phone(1260, 145, 300, 650, rating, rotate: 6)}
SVG

save('04-social-profile', 1600, 900, <<~SVG)
  <rect width="1600" height="900" fill="#{BG}"/>
  <circle cx="260" cy="760" r="280" fill="#DF3A62" opacity=".12" filter="url(#soft)"/>
  #{phone(110, 90, 370, 800, profile, rotate: -4)}
  <text x="610" y="180" fill="#{PINK}" font-family="SF Pro Display,Arial" font-size="29" font-weight="750" letter-spacing="4">SOCIAL, NOT INVASIVE</text>
  <text x="605" y="300" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="90" font-weight="800">Your public taste.</text>
  <text x="605" y="395" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="90" font-weight="800">Your private history.</text>
  <rect x="610" y="500" width="820" height="230" rx="38" fill="#{SURFACE}" stroke="#2B3340" stroke-width="3"/>
  <text x="665" y="575" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="31" font-weight="750">Connect through what you watch</text>
  <text x="665" y="638" fill="#{MUTED}" font-family="SF Pro Text,Arial" font-size="27">Ratings, reviews and profiles are social.</text>
  <text x="665" y="688" fill="#{MUTED}" font-family="SF Pro Text,Arial" font-size="27">Viewing history stays yours.</text>
SVG

save('twitter-header', 1500, 500, <<~SVG)
  <rect width="1500" height="500" fill="url(#glow)"/>
  <circle cx="1240" cy="80" r="240" fill="#DF3A62" opacity=".2" filter="url(#soft)"/>
  <text x="300" y="210" fill="#{TEXT}" font-family="SF Pro Display,Arial" font-size="106" font-weight="850">Watchly</text>
  <text x="305" y="280" fill="#{PINK}" font-family="SF Pro Display,Arial" font-size="30" font-weight="650">Your watch life. Beautifully organized.</text>
  <text x="305" y="345" fill="#{MUTED}" font-family="SF Pro Text,Arial" font-size="24">DISCOVER  ·  TRACK  ·  RATE  ·  SHARE</text>
  #{phone(1040, -220, 250, 540, home, rotate: -8)}
  #{phone(1240, -70, 250, 540, explore, rotate: 7)}
SVG

save('avatar', 500, 500, <<~SVG)
  <rect width="500" height="500" rx="125" fill="#{BG}"/>
  <circle cx="250" cy="250" r="175" fill="#1A0C14" stroke="#{RASPBERRY}" stroke-width="8"/>
  <path d="M135 155 L190 345 L250 215 L310 345 L365 155" fill="none" stroke="url(#rasp)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
SVG

puts "Generated SVG assets in #{OUT}"
