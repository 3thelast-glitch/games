#!/usr/bin/env python3
"""Batch transcription of the 105 supplied screenshots, never legacy/start maps.

Usage: python3 scripts/apple_worm_screenshot_stages.py --frames PATH --qa PATH
Requires numpy, opencv-python-headless. Source media remains external to the app.
All statuses stay pending: extraction is evidence, not visual acceptance.
"""
import argparse
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np


def cells(mask, threshold, radius=9):
    result=[]
    for y in range(12):
        for x in range(21):
            cx,cy=33+30*x,13+30*y
            patch=mask[max(0,cy-radius):cy+radius+1,max(0,cx-radius):cx+radius+1]
            if patch.size and patch.mean()>=threshold:
                result.append([x,y])
    return result


def order_body(points, head):
    """Only accept an unambiguous connected path from the visible mouth."""
    paths=[]
    def visit(path):
        if len(paths)>1:return
        if len(path)==len(points):paths.append(path);return
        for p in points:
            if p not in path and sum(abs(a-b) for a,b in zip(p,path[-1]))==1:
                visit(path+[p])
    if head in points:visit([head])
    return paths[0] if len(paths)==1 else None


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--frames',type=Path,required=True)
    ap.add_argument('--qa',type=Path,required=True);args=ap.parse_args()
    args.qa.mkdir(parents=True,exist_ok=True)
    # Portal is a reference-only recognition template, never shipped artwork.
    example=cv2.imread(str(args.frames/'stage_001.jpg'))
    template=cv2.cvtColor(example[181:214,442:476],cv2.COLOR_BGR2GRAY)
    saw_example=cv2.imread(str(args.frames/'stage_032.jpg'))
    saw_template=cv2.cvtColor(saw_example[89:117,169:197],cv2.COLOR_BGR2GRAY)
    corrections=json.loads(Path("packages/games/apple-worm/screenshot-corrections.json").read_text())
    records=[]
    for n in range(1,106):
        path=args.frames/f'stage_{n:03}.jpg';im=cv2.imread(str(path))
        if im is None or im.shape!=(360,640,3):raise ValueError(str(path))
        hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV);h,s,v=cv2.split(hsv)
        ground=(h>=6)&(h<=25)&(s>125)&(v>35)&(v<195)
        green=(h>=35)&(h<=80)&(s>210)&(v>35)&(v<230)
        red=((h<6)|(h>175))&(s>195)&(v>70)
        gray=(h>=85)&(h<=125)&(s<123)&(v>=50)&(v<=200)
        purple=(h>=130)&(h<169)&(s>125)&(v>55)
        # Exclude source HUD and distant landscape; retain top-edge puzzle pieces.
        for mask in [ground,green,red,gray,purple]:
            mask[:37,110:188]=False
            mask[:34,470:]=False
            mask[239:,505:]=False
        terrain=cells(ground,.44);worm=cells(green,.28);apples=cells(red,.18)
        gray_cells=cells(gray,.64)
        # Separate round saws from pushable squares by their four outside corners.
        boxes=[];hazards=[]
        for x,y in gray_cells:
            cx,cy=33+x*30,13+y*30
            corners=[gray[cy+dy,cx+dx] for dx in [-11,11] for dy in [-11,11]]
            region=cv2.cvtColor(im[max(0,cy-18):cy+19,max(0,cx-18):cx+19],cv2.COLOR_BGR2GRAY)
            saw_score=cv2.minMaxLoc(cv2.matchTemplate(region,saw_template,cv2.TM_CCOEFF_NORMED))[1] if min(region.shape)>=28 else 0
            if n<=30 or saw_score<.65:boxes.append([x,y])
            else:hazards.append({'kind':'saw','position':[x,y]})
        # Mouth position distinguishes persistent head from tail and apple leaves.
        count,_,stats,centroids=cv2.connectedComponentsWithStats(purple.astype('uint8'))
        candidates=[(stats[i,cv2.CC_STAT_AREA],centroids[i]) for i in range(1,count)
                    if stats[i,cv2.CC_STAT_AREA]>=8]
        mouth=max(candidates,key=lambda p:p[0])[1] if candidates else None
        head=[round((mouth[0]-33)/30),round((mouth[1]-13)/30)] if mouth is not None else None
        if head and head not in worm:worm.append(head)
        ordered=order_body(worm,head) if head else None
        match=cv2.matchTemplate(cv2.cvtColor(im,cv2.COLOR_BGR2GRAY),template,cv2.TM_CCOEFF_NORMED)
        match[:31,100:190]=-1;match[:30,470:]=-1;match[225:,490:]=-1
        _,score,_,(px,py)=cv2.minMaxLoc(match)
        pixel=[px+17,py+16]
        portal=[round((pixel[0]-33)/30),round((pixel[1]-13)/30)] if score>.64 else None
        issues=[]
        if ordered is None:issues.append('worm_path_ambiguous')
        if portal is None:issues.append('portal_not_visible_or_not_detected')
        overlap=[p for p in worm if p in terrain]
        if overlap:issues.append('worm_terrain_overlap')
        # No inference about a missing apple: the visible fruit set IS the start set.
        rec={'id':n,'sourceImage':path.name,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
             'width':21,'height':12,'sourceDimensions':[640,360],'gridOrigin':[33,13],'gridPitch':30,
             'terrain':terrain,'worm':ordered or worm,'wormHead':head,'apples':apples,
             'portal':portal,'portalPixel':pixel if portal else None,'portalConfidence':round(score,3),
             'hazards':hazards,'movableObjects':boxes,'terrainStyle':'earth' if n<=30 else 'brick',
             'sourceType':'provided-screenshot','visualVerification':'pending',
             'gameplayVerification':'pending','unresolved':issues}
        key=str(n)
        rec['terrain'] += [p for p in corrections.get('terrainAdditions',{}).get(key,[]) if p not in rec['terrain']]
        if key in corrections['portalCells']:
            rec['portal']=corrections['portalCells'][key]
            rec['portalPixel']=[33+30*rec['portal'][0]+5,13+30*rec['portal'][1]+4] if rec['portal'] else None
            rec['portalConfidence']=None
            rec['unresolved']=[i for i in rec['unresolved'] if i!='portal_not_visible_or_not_detected']
        if n>30:
            rec['movableObjects']=corrections['boxCellsAfter30'].get(key,[])
            rec['hazards']=[{'kind':'saw','position':p} for p in gray_cells if p not in rec['movableObjects']]
        rec['hazards'] += [{'kind':'spike','position':[x,y],'direction':direction}
                           for x,y,direction in corrections['spikes'].get(key,[])]
        if key in corrections['initialWormOverrides']:
            rec['worm']=corrections['initialWormOverrides'][key];rec['wormHead']=rec['worm'][0]
            rec['unresolved']=[i for i in rec['unresolved'] if i!='worm_path_ambiguous']
        rec['unresolved']+=corrections['unresolved'].get(key,[])
        rec['completionRule']='portal'
        if not rec['portal']:
            rec['adaptation']='No portal added: movement practice remains available, completion unresolved.'
        rec['mechanicsPolicy']='Turn-based rigid worm gravity, pushable boxes; saws fixed at screenshot positions.'
        records.append(rec)
        overlay=im.copy()
        for kind,pts,color in [('T',terrain,(0,255,255)),('W',worm,(255,0,255)),('A',apples,(255,255,255)),('B',boxes,(0,255,0)),('S',[q['position'] for q in hazards],(255,255,0))]:
            for x,y in pts:
                cx,cy=33+30*x,13+30*y
                cv2.rectangle(overlay,(cx-14,cy-14),(cx+14,cy+14),color,1)
                cv2.putText(overlay,f'{kind}{x},{y}',(cx-13,cy),cv2.FONT_HERSHEY_PLAIN,.55,color,1)
        if head:cv2.circle(overlay,(33+head[0]*30,13+head[1]*30),6,(0,0,255),2)
        if portal:cv2.circle(overlay,tuple(pixel),17,(0,255,0),2)
        cv2.imwrite(str(args.qa/f'{n:03}.jpg'),np.hstack([im,overlay]))
    target=Path('packages/games/apple-worm/screenshot-stages-105.json')
    target.write_text('[\n'+',\n'.join(json.dumps(r,separators=(',',':')) for r in records)+'\n]\n')
    print(json.dumps([{'id':r['id'],'worm':r['worm'],'portal':r['portal'],'apples':len(r['apples']),'boxes':len(r['movableObjects']),'saws':len(r['hazards']),'issues':r['unresolved']} for r in records]))


if __name__=='__main__':main()
