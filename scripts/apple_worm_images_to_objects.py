#!/usr/bin/env python3
"""Extract APPLE WORM puzzle object candidates from already-extracted images.

Usage:
  python -m pip install opencv-python numpy
  python scripts/apple_worm_images_to_objects.py \
      --frames AppleWorm_105_Video_Reference/frames \
      --out AppleWorm_ImageOnly_105

This DOES NOT OPEN OR DECODE THE MP4. It reads each existing
stage_001.jpg ... stage_105.jpg once. Some source screenshots show mid-game,
after fruit was eaten, or with the portal offscreen. No result is certified
as an original initial pose, final level, or a mechanically verified solution.
"""
import argparse
import csv
import json
from pathlib import Path
import cv2
import numpy as np

GRID_ORIGIN = (33,73)
GRID_STEP = 30

def objects_from_still(image):
    hsv=cv2.cvtColor(image,cv2.COLOR_BGR2HSV)
    found={'appleCells':[],'greenWormCells':[],'grayObjectCells':[]}
    marked=image.copy()
    for y in range(-1,9):
        for x in range(21):
            cx,cy=33+30*x,73+30*y
            if not (85<=cx<=505 and 45<=cy<=307):
                continue
            p=hsv[cy-9:cy+10,cx-9:cx+10]
            h,s,v=p[:,:,0],p[:,:,1],p[:,:,2]
            red=np.count_nonzero((h<=5)&(s>=175)&(v>=110))
            green=np.count_nonzero((h>=38)&(h<=80)&(s>=175)&(v>=35))
            gray=np.count_nonzero((h>=87)&(h<=125)&(s<123)&(v>=50)&(v<=200))
            key=None
            color=None
            if red>=80:
                key,color='appleCells',(0,20,255)
            elif green>=125 and cy<=277:
                key,color='greenWormCells',(5,180,20)
            elif gray>=235:
                key,color='grayObjectCells',(255,130,0)
            if key:
                found[key].append([x,y])
                cv2.rectangle(marked,(cx-12,cy-12),(cx+12,cy+12),color,2)
    return found,marked

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--frames',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    (args.out/'qa').mkdir(exist_ok=True)
    template_frame=cv2.imread(str(args.frames/'stage_011.jpg'))
    if template_frame is None or template_frame.shape[:2]!=(360,640):
        raise ValueError('Expected stage_011.jpg reference image of size 640x360')
    # Dark spiral shape, stage 11. Used for locating POSSIBLE portals only.
    template=cv2.cvtColor(template_frame,cv2.COLOR_BGR2GRAY)[123:150,384:412]
    records=[]
    statuses=[]
    for level in range(1,106):
        filename=f'stage_{level:03}.jpg'
        frame=cv2.imread(str(args.frames/filename))
        if frame is None or frame.shape[:2]!=(360,640):
            raise ValueError(f'Invalid/missing image: {filename}')
        found,overlay=objects_from_still(frame)
        gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
        match=cv2.matchTemplate(gray[:245,65:535],template,cv2.TM_CCOEFF_NORMED)
        _,confidence,_,(left,top)=cv2.minMaxLoc(match)
        pixel=[int(left+65+template.shape[1]/2),int(top+template.shape[0]/2)]
        portal=(pixel if confidence>=0.62 and not (pixel[1]<38 and pixel[0]>=450) else None)
        if portal:
            cv2.circle(overlay,tuple(portal),19,(0,255,255),2)
        warnings=['snapshot_may_show_midmove_not_original_initial_pose']
        if not found['appleCells']:
            warnings.append('no_visible_apple_does_not_mean_no_start_apple')
        if not found['greenWormCells']:
            warnings.append('worm_may_be_hidden_or_classifier_miss')
        if found['grayObjectCells']:
            warnings.append('gray_obstacles_need_saw_vs_box_review')
        if portal is None:
            warnings.append('portal_not_visibly_confirmed')
        record={
            'level':level,'sourceImage':filename,
            'referenceGrid':{'width':21,'height':9,'origin':[33,73],'pitch':30},
            **found,
            'visiblePortalPixel':portal,
            'visiblePortalCellApprox':[
                round((portal[0]-33)/30),round((portal[1]-73)/30)
            ] if portal else None,
            'portalTemplateConfidence':round(float(confidence),3),
            'warnings':warnings,
            'sourceInitialStateVerified':False,
            'sourceWinningMovesVerified':False,
            'readyForLiveGame':False,
        }
        records.append(record)
        statuses.append({
            'level':level,
            'apples_visible':len(found['appleCells']),
            'worm_cells_visible':len(found['greenWormCells']),
            'gray_objects_visible':len(found['grayObjectCells']),
            'portal_visible':portal is not None,
            'portal_template_confidence':round(float(confidence),3),
            'all_initial_objects_verified':False,
        })
        cv2.imwrite(str(args.out/'qa'/f'level_{level:03d}.jpg'),
            cv2.resize(np.hstack([frame,overlay]),(960,270),
                       interpolation=cv2.INTER_AREA),
            [cv2.IMWRITE_JPEG_QUALITY,78])
    (args.out/'objects_001-105.json').write_text(
        json.dumps(records,indent=2),encoding='utf-8')
    with (args.out/'image_object_index.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,statuses[0].keys())
        w.writeheader()
        w.writerows(statuses)
    print('105 archived frames classified; NO level certified ready for play')

if __name__=='__main__':
    main()
