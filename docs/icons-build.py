"""Mycarwash.ph 3D icon pack (adapted from Barbers.ph build.py): cut-out (rembg isnet mask, hardened), River contact shadow, sizes, manifest, contact sheet."""
import json, os, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from rembg import remove, new_session
SESSION=new_session('isnet-general-use')
from scipy import ndimage
FLOOR=int(os.environ.get("FLOOR","214"))
P='/workspace/icons/carwash-pack'
OUT='/workspace/mycarwashph/frontend/public/icons3d/carwash'
ICONS=[
 ('carwash','service',['car-wash','wash','basic-wash']),
 ('foam','service',['soap','snow-foam','bubbles']),
 ('pressure-washer','service',['pressure','rinse','jet']),
 ('vacuum','service',['vacuum-only']),
 ('wax','service',['wax-coating','coating','polish']),
 ('tire-shine','service',['add-ons','tire-black','tyre']),
 ('engine','service',['engine-wash','engine-bay']),
 ('interior','service',['interior-clean','seats']),
 ('detailing','service',['detail','sparkle']),
 ('sedan','vehicle',['small','medium','car']),
 ('suv','vehicle',['large','xl','pickup']),
 ('motorcycle','vehicle',['motor','bike']),
 ('queue','nav',['walk-ins','line','bays']),
 ('home','nav',['shop','dashboard']),
 ('ticket','nav',['order','booking','history']),
 ('moments','nav',['community','feed']),
 ('empty-queue','empty',['no-queue','no-cars']),
]
def cut(path):
    im=Image.open(path).convert('RGB')
    m=np.asarray(remove(im,session=SESSION,only_mask=True)).astype(np.float32)
    alpha=np.clip((m-12)*4,0,255)
    # union with a border flood-fill key, so cream/white parts rembg drops (walls, screens) stay opaque
    a=np.asarray(im).astype(np.int16); mn=a.min(2); mx=a.max(2)
    lab,_=ndimage.label(((mx-mn)<14)&(mn>=FLOOR)); edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    shadow=ndimage.binary_dilation(np.isin(lab,list(edge)),iterations=3)
    flood=np.where(shadow,0,255).astype(np.float32)
    flood=np.asarray(Image.fromarray(flood.astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32)
    alpha=np.maximum(alpha,flood)
    # Halo fix (Oct 24, 2026): the source's soft grey floor shadow is near-neutral and light; where rembg says
    # background, trust rembg there so the shadow doesn't stay as a pale patch (our own contact shadow replaces it).
    halo=((mx-mn)<20)&(mn>=150)&(m<90)
    alpha=np.where(halo,np.clip((m-12)*4,0,255),alpha)
    al=Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    rgba=im.convert('RGBA'); rgba.putalpha(al)
    bb=al.point(lambda v:255 if v>40 else 0).getbbox(); rgba=rgba.crop(bb)
    s=400/max(rgba.size); rgba=rgba.resize((max(1,int(rgba.width*s)),max(1,int(rgba.height*s))),Image.LANCZOS)
    c=Image.new('RGBA',(512,512),(0,0,0,0)); x=(512-rgba.width)//2; y=(512-rgba.height)//2-8
    sh=Image.new('L',(512,512),0); d=ImageDraw.Draw(sh); w=rgba.width*0.38; by=y+rgba.height
    d.ellipse((256-w,by-10,256+w,by+10),fill=70); sh=sh.filter(ImageFilter.GaussianBlur(12))
    shl=Image.new('RGBA',(512,512),(0,0,0,0)); shl.putalpha(sh)
    c=Image.alpha_composite(c,shl); c.alpha_composite(rgba,(x,y)); return c
os.makedirs(f'{P}/png/512',exist_ok=True)
for d in ['256','128']: os.makedirs(f'{OUT}/{d}',exist_ok=True)
man={'name':'mycarwash-ph-3d-icons','version':'1.0.0','app':'Mycarwash.ph','style':'River 3D glossy soft plastic (River UI kit docs/icons/ICON-STYLE.md), top-left light, soft contact shadow, transparent background','palette':{'blue':'#2F8CF0','orange':'#F57C1F','green':'#4CB860','teal':'#20B2AA','yellow':'#F8C32E','cream':'#F6F0E4'},'sizes':{'webp':[256,128]},'icons':[]}
cells=[]
for k,g,al in ICONS:
    full=cut(f'{P}/src/{k}.jpg'); full.save(f'{P}/png/512/{k}.png')
    s=full.resize((256,256),Image.LANCZOS); s.save(f'{OUT}/256/{k}.webp','WEBP',quality=88,method=6)
    full.resize((128,128),Image.LANCZOS).save(f'{OUT}/128/{k}.webp','WEBP',quality=88,method=6)
    man['icons'].append({'concept':k,'group':g,'aliases':al,'files':{'webp256':f'256/{k}.webp','webp128':f'128/{k}.webp'}}); cells.append((k,s))
json.dump(man,open(f'{OUT}/manifest.json','w'),indent=2)
cols=6; rows=(len(cells)+cols-1)//cols
for name,bgc in [('contact-sheet.png','white'),('contact-sheet-dark.png','#2a2f36')]:
    S=Image.new('RGB',(cols*180,rows*200),bgc); d=ImageDraw.Draw(S)
    for i,(k,img) in enumerate(cells):
        x,y=(i%cols)*180,(i//cols)*200; t=img.resize((160,160),Image.LANCZOS); S.paste(t,(x+10,y+5),t); d.text((x+14,y+175),k,fill='black' if bgc=='white' else 'white')
    S.save(f'{P}/{name}')
