"""River Apps UI Kit: 3D-style illustrations as SVG (original artwork, generated in code; no stock images).
Ported from the Mycarwash v5 mockups. Used by generate.py."""

def bubble(cx, cy, r, p, op=1.0):
    return (f'<g opacity="{op}"><circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{p}bub)"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r-0.6}" fill="none" stroke="url(#{p}iri)" stroke-width="{max(1,r*0.09):.2f}"/>'
            f'<ellipse cx="{cx-r*0.38:.1f}" cy="{cy-r*0.42:.1f}" rx="{r*0.32:.1f}" ry="{r*0.18:.1f}" fill="#fff" opacity=".85" transform="rotate(-35 {cx-r*0.38:.1f} {cy-r*0.42:.1f})"/>'
            f'<circle cx="{cx+r*0.42:.1f}" cy="{cy+r*0.40:.1f}" r="{r*0.08:.1f}" fill="#fff" opacity=".7"/></g>')

def drop(x, y, s, p, op=1.0):
    # teardrop pointing up, s = height
    w = s*0.62
    return (f'<g transform="translate({x} {y})" opacity="{op}"><path d="M0 {-s/2} C {w*0.15} {-s*0.2}, {w/2} {s*0.02}, {w/2} {s*0.18} A {w/2} {w/2} 0 1 1 {-w/2} {s*0.18} C {-w/2} {s*0.02}, {-w*0.15} {-s*0.2}, 0 {-s/2} Z" fill="url(#{p}drop)"/>'
            f'<ellipse cx="{-w*0.18:.1f}" cy="{s*0.12:.1f}" rx="{w*0.1:.1f}" ry="{s*0.16:.1f}" fill="#fff" opacity=".8"/></g>')

def defs(p, body=('#BFE0FF', '#4C9BFF', '#1F4FD1')):
    t, m, b = body
    return f'''<defs>
<linearGradient id="{p}body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{t}"/><stop offset=".45" stop-color="{m}"/><stop offset="1" stop-color="{b}"/></linearGradient>
<linearGradient id="{p}lower" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{b}" stop-opacity="0"/><stop offset="1" stop-color="#0B1E5B" stop-opacity=".55"/></linearGradient>
<linearGradient id="{p}glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B3442"/><stop offset=".55" stop-color="#121822"/><stop offset="1" stop-color="#06090F"/></linearGradient>
<linearGradient id="{p}refl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="{p}tyre" cx=".45" cy=".4" r=".65"><stop offset="0" stop-color="#3A3D44"/><stop offset=".7" stop-color="#16181C"/><stop offset="1" stop-color="#050506"/></radialGradient>
<radialGradient id="{p}rim" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#D5DAE1"/><stop offset="1" stop-color="#7C8592"/></radialGradient>
<radialGradient id="{p}bub" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#fff" stop-opacity=".04"/><stop offset=".85" stop-color="#E9F4FF" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity=".75"/></radialGradient>
<linearGradient id="{p}iri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB8E1"/><stop offset=".35" stop-color="#B9E2FF"/><stop offset=".7" stop-color="#C7FFE6"/><stop offset="1" stop-color="#FFE9A8"/></linearGradient>
<linearGradient id="{p}drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFEAFF"/><stop offset=".6" stop-color="#5FB2FF"/><stop offset="1" stop-color="#2F7DF0"/></linearGradient>
<radialGradient id="{p}foam" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#F1F5FB"/><stop offset="1" stop-color="#C9D3E2"/></radialGradient>
<radialGradient id="{p}head" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFBEA"/><stop offset="1" stop-color="#FFD66B"/></radialGradient>
<filter id="{p}blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="{p}soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
</defs>'''

def wheel(cx, cy, p):
    spokes = ''.join(f'<rect x="{cx-2.2}" y="{cy-15}" width="4.4" height="13" rx="2.2" fill="#9AA3AF" transform="rotate({a} {cx} {cy})"/>' for a in range(0, 360, 72))
    return (f'<circle cx="{cx}" cy="{cy}" r="29" fill="url(#{p}tyre)"/>'
            f'<circle cx="{cx}" cy="{cy}" r="18" fill="url(#{p}rim)"/>{spokes}'
            f'<circle cx="{cx}" cy="{cy}" r="5.5" fill="#E5E8EC" stroke="#8B95A3" stroke-width="1"/>'
            f'<path d="M{cx-20} {cy-14} A 25 25 0 0 1 {cx+8} {cy-24}" stroke="#fff" stroke-opacity=".25" stroke-width="3" fill="none" stroke-linecap="round"/>')

def car(p='c', body=None, bubbles=True, foam=True, w=400, extra=''):
    """Side-view glossy hatchback in viewBox 0 0 400 230."""
    d = defs(p) if body is None else defs(p, body)
    shape = ('M34 150 C32 132 40 124 58 120 L98 112 C118 86 140 72 176 68 L246 67 C276 68 296 82 318 104 L352 110 '
             'C370 114 378 124 377 140 L375 154 C374 162 369 165 361 165 L334 165 A34 34 0 0 0 266 165 L139 165 '
             'A34 34 0 0 0 71 165 L46 165 C38 165 35 160 34 150 Z')
    glass = 'M112 112 C130 90 148 80 178 77 L244 76 C268 78 286 90 300 108 Z'
    s = f'<svg viewBox="0 0 400 230" width="{w}" xmlns="http://www.w3.org/2000/svg" class="art">{d}'
    s += f'<ellipse cx="205" cy="198" rx="168" ry="11" fill="#000" opacity=".35" filter="url(#{p}blur)"/>'
    s += f'<path d="{shape}" fill="url(#{p}body)"/>'
    s += f'<path d="{shape}" fill="url(#{p}lower)"/>'
    # shoulder highlight
    s += f'<path d="M60 124 C120 112 250 108 350 116" stroke="#fff" stroke-opacity=".75" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#{p}soft)"/>'
    s += f'<path d="M150 74 C190 70 240 70 270 74" stroke="#fff" stroke-opacity=".8" stroke-width="3" fill="none" stroke-linecap="round"/>'
    s += f'<path d="{glass}" fill="url(#{p}glass)"/>'
    s += f'<path d="M150 108 L176 79 L196 79 L170 108 Z" fill="url(#{p}refl)" opacity=".55"/>'
    s += f'<path d="M232 108 L248 78 L258 79 L242 108 Z" fill="url(#{p}refl)" opacity=".4"/>'
    s += '<rect x="203" y="74" width="7" height="36" rx="2" fill="#0B1E5B" opacity=".55"/>'
    # door seams and handle
    s += '<path d="M206 112 L206 160 M118 116 L124 160" stroke="#0B1E5B" stroke-opacity=".25" stroke-width="1.5"/>'
    s += '<rect x="222" y="122" width="18" height="4" rx="2" fill="#fff" opacity=".6"/><rect x="138" y="124" width="18" height="4" rx="2" fill="#fff" opacity=".6"/>'
    # lights
    s += f'<path d="M356 118 C366 119 372 124 373 132 L356 131 Z" fill="url(#{p}head)"/>'
    s += '<path d="M36 132 C37 126 42 123 50 122 L50 134 Z" fill="#FF5A5F"/>'
    s += '<rect x="330" y="146" width="40" height="5" rx="2.5" fill="#0B1E5B" opacity=".35"/>'
    s += '<path d="M71 165 A34 34 0 0 1 139 165 Z M266 165 A34 34 0 0 1 334 165 Z" fill="#0A0F1C"/>'
    s += wheel(105, 165, p) + wheel(300, 165, p)
    if foam:
        s += '<!--foam-->'
        f = [(150, 66, 13), (168, 58, 16), (190, 56, 14), (210, 60, 17), (232, 58, 13), (250, 64, 11), (178, 70, 10), (222, 70, 11)]
        s += ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#{p}foam)"/>' for x, y, r in f)
        s += ''.join(f'<circle cx="{x-r*.3:.1f}" cy="{y-r*.35:.1f}" r="{r*.28:.1f}" fill="#fff"/>' for x, y, r in f[:6])
        s += f'<circle cx="320" cy="122" r="9" fill="url(#{p}foam)"/><circle cx="332" cy="128" r="6" fill="url(#{p}foam)"/><circle cx="88" cy="126" r="7" fill="url(#{p}foam)"/>'
        s += '<!--/foam-->'
    if bubbles:
        s += '<!--bubbles-->'
        for (x, y, r, o) in [(70, 70, 16, 1), (40, 40, 9, .9), (110, 34, 11, .9), (300, 40, 18, 1), (345, 72, 10, .9), (370, 30, 7, .8), (265, 22, 8, .8), (20, 96, 6, .8)]:
            s += bubble(x, y, r, p, o)
        s += drop(332, 92, 18, p) + drop(64, 104, 14, p, .9)
        s += '<!--/bubbles-->'
    s += extra + '</svg>'
    return s

# ---------- small 3D service icons (viewBox 64) ----------
def icon_defs(p):
    return f'''<defs>
<radialGradient id="{p}b1" cx=".42" cy=".4" r=".6"><stop offset="0" stop-color="#EAF4FF"/><stop offset=".6" stop-color="#9CCBFF"/><stop offset="1" stop-color="#4F95F5"/></radialGradient>
<linearGradient id="{p}iri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9FD2"/><stop offset=".4" stop-color="#7CC4FF"/><stop offset=".75" stop-color="#8CF0C4"/><stop offset="1" stop-color="#FFD66B"/></linearGradient>
<linearGradient id="{p}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF4B8"/><stop offset=".45" stop-color="#FFC93C"/><stop offset="1" stop-color="#F08C00"/></linearGradient>
<linearGradient id="{p}peach" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD9BF"/><stop offset=".5" stop-color="#FF8A4C"/><stop offset="1" stop-color="#E4572E"/></linearGradient>
<linearGradient id="{p}lil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E7DDFF"/><stop offset=".5" stop-color="#9B7BFF"/><stop offset="1" stop-color="#5B3FD6"/></linearGradient>
<linearGradient id="{p}mint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9F7E1"/><stop offset=".5" stop-color="#34D399"/><stop offset="1" stop-color="#0E9F6E"/></linearGradient>
<linearGradient id="{p}sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D5EBFF"/><stop offset=".5" stop-color="#5FA8FF"/><stop offset="1" stop-color="#2563EB"/></linearGradient>
<radialGradient id="{p}tyre" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#4A4E57"/><stop offset=".7" stop-color="#1B1D22"/><stop offset="1" stop-color="#060708"/></radialGradient>
<radialGradient id="{p}rim" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#D6DBE2"/><stop offset="1" stop-color="#7E8794"/></radialGradient>
<filter id="{p}sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.2" flood-color="#0A0A0A" flood-opacity=".22"/></filter>
</defs>'''

def _ib(cx, cy, r, p):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{p}b1)"/><circle cx="{cx}" cy="{cy}" r="{r-.6}" fill="none" stroke="url(#{p}iri)" stroke-width="{max(1.2,r*.12):.1f}"/>'
            f'<ellipse cx="{cx-r*.35:.1f}" cy="{cy-r*.4:.1f}" rx="{r*.3:.1f}" ry="{r*.17:.1f}" fill="#fff" transform="rotate(-35 {cx-r*.35:.1f} {cy-r*.4:.1f})"/>')

_N=[0]
def ico(kind, size=40, p=None):
    _N[0]+=1
    p = p or f'i{kind[:2]}{size}n{_N[0]}'
    s = f'<svg viewBox="0 0 64 64" width="{size}" height="{size}" class="ico">{icon_defs(p)}<g filter="url(#{p}sh)">'
    if kind == 'wash':  # soap bubbles
        s += _ib(26, 36, 17, p) + _ib(44, 24, 11, p) + _ib(47, 45, 8, p)
    elif kind == 'vacuum':  # canister vacuum with hose
        s += f'<path d="M22 20 C22 12 30 8 38 10" stroke="url(#{p}lil)" stroke-width="5" fill="none" stroke-linecap="round"/>'
        s += f'<path d="M38 10 L50 10" stroke="url(#{p}lil)" stroke-width="5" stroke-linecap="round"/><rect x="46" y="6" width="12" height="9" rx="3" fill="url(#{p}lil)"/>'
        s += f'<rect x="8" y="20" width="44" height="30" rx="12" fill="url(#{p}peach)"/>'
        s += '<rect x="14" y="25" width="22" height="8" rx="4" fill="#fff" opacity=".55"/>'
        s += f'<circle cx="41" cy="35" r="6" fill="#fff" opacity=".9"/><circle cx="41" cy="35" r="3" fill="url(#{p}peach)"/>'
        s += f'<circle cx="16" cy="52" r="5" fill="url(#{p}tyre)"/><circle cx="44" cy="52" r="5" fill="url(#{p}tyre)"/>'
    elif kind == 'detail':  # sparkle
        s += f'<path d="M30 6 C32 20 36 26 50 30 C36 34 32 40 30 56 C28 40 24 34 10 30 C24 26 28 20 30 6 Z" fill="url(#{p}gold)"/>'
        s += f'<path d="M50 40 C51 46 53 48 58 49 C53 50 51 52 50 58 C49 52 47 50 42 49 C47 48 49 46 50 40 Z" fill="url(#{p}lil)"/>'
        s += f'<path d="M50 6 C50.6 10 52 11.4 56 12 C52 12.6 50.6 14 50 18 C49.4 14 48 12.6 44 12 C48 11.4 49.4 10 50 6 Z" fill="url(#{p}sky)"/>'
        s += '<path d="M24 22 C26 18 28 16 30 14" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>'
    elif kind == 'tyre':
        s += f'<circle cx="32" cy="32" r="24" fill="url(#{p}tyre)"/>'
        s += ''.join(f'<rect x="30.5" y="8.5" width="3" height="6" rx="1.2" fill="#2E3138" transform="rotate({a} 32 32)"/>' for a in range(0, 360, 30))
        s += f'<circle cx="32" cy="32" r="13" fill="url(#{p}rim)"/>'
        s += ''.join(f'<rect x="30.6" y="21" width="2.8" height="9" rx="1.4" fill="#8E97A4" transform="rotate({a} 32 32)"/>' for a in range(0, 360, 72))
        s += '<circle cx="32" cy="32" r="3.6" fill="#E9ECEF"/><path d="M15 22 A 20 20 0 0 1 30 11" stroke="#fff" stroke-opacity=".3" stroke-width="3" fill="none" stroke-linecap="round"/>'
    elif kind == 'drop':
        s += f'<path d="M32 6 C38 18 50 28 50 40 A18 18 0 0 1 14 40 C14 28 26 18 32 6 Z" fill="url(#{p}sky)"/>'
        s += '<ellipse cx="25" cy="40" rx="4" ry="8" fill="#fff" opacity=".75"/>'
    elif kind == 'car':
        s += f'<path d="M8 40 C8 34 11 32 16 31 L22 23 C24 20 27 19 31 19 L41 19 C45 19 48 21 50 24 L54 31 C58 32 58 35 58 40 L58 44 C58 46 57 47 55 47 L11 47 C9 47 8 46 8 44 Z" fill="url(#{p}sky)"/>'
        s += '<path d="M24 30 L28 23 C29 22 30 21.5 32 21.5 L40 21.5 C42 21.5 43.5 22.5 44.5 24 L48 30 Z" fill="#1A2230"/>'
        s += f'<circle cx="19" cy="47" r="6.5" fill="url(#{p}tyre)"/><circle cx="47" cy="47" r="6.5" fill="url(#{p}tyre)"/><circle cx="19" cy="47" r="2.6" fill="#D6DBE2"/><circle cx="47" cy="47" r="2.6" fill="#D6DBE2"/>'
        s += '<path d="M13 33 C25 31 41 31 53 33" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linecap="round"/>'
    elif kind == 'chat':  # SMS bubble
        s += f'<path d="M10 16 C10 11 14 8 19 8 L45 8 C50 8 54 11 54 16 L54 34 C54 39 50 42 45 42 L28 42 L17 51 L19 42 C14 42 10 39 10 34 Z" fill="url(#{p}sky)"/>'
        s += '<circle cx="22" cy="25" r="3.4" fill="#fff"/><circle cx="32" cy="25" r="3.4" fill="#fff"/><circle cx="42" cy="25" r="3.4" fill="#fff"/>'
        s += '<path d="M15 16 C16 13 18 12 21 12" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    elif kind == 'shield':
        s += f'<path d="M32 6 L52 13 L52 30 C52 43 43 52 32 57 C21 52 12 43 12 30 L12 13 Z" fill="url(#{p}mint)"/>'
        s += '<path d="M23 31 L29.5 37.5 L42 25" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        s += '<path d="M17 16 L30 11" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/>'
    elif kind == 'check':
        s += f'<circle cx="32" cy="32" r="24" fill="url(#{p}mint)"/>'
        s += '<path d="M21 33 L29 41 L44 25" stroke="#fff" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        s += '<path d="M16 22 A 19 19 0 0 1 30 12" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>'
    elif kind == 'coin':
        s += f'<circle cx="32" cy="32" r="22" fill="url(#{p}gold)"/><circle cx="32" cy="32" r="16" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>'
        s += '<text x="32" y="40" text-anchor="middle" font-size="22" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans">₱</text>'
    s += '</g></svg>'
    return s
