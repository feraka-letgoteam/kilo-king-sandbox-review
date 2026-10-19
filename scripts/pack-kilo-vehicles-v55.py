"""Pack generated vehicle drawings without painting, masks or alpha replacement.

Only cell extraction, a common uniform scale, and per-frame rigid registration
are applied. Proof renders are asset contact sheets, not live game evidence.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art/kilo-v55/vehicles"
OUT = ROOT / "public/kilo-v55/vehicles"
OUT.mkdir(parents=True, exist_ok=True)

CONFIG = {
    "chopper": {
        "source": "chopper-source.png", "output": "chopper-action.webp",
        "frame": [512, 320], "anchor": [.5, .5],
        "registration": [256, 104], "registrationPart": "main rotor hub",
        "sourcePivots": [[246,180],[253,174],[244,174],[239,162],
                         [230,148],[237,144],[231,147],[230,160]],
        "scale": .78, "drawWidthCells": 2.2,
        "durationMs": [100,100,120,100,180,100,100,100],
        "names": ["approach-bank","level-in","hover","hatch-open",
                  "hook-release","hook-retract","exit-bank","depart"],
        "cargoDropPoint": [248, 278],
        "description": "Eight authored views: bank, rotor phase, cargo hatch and hook.",
    },
    "boat": {
        "source": "getaway-separated-source.png", "output": "getaway-action.webp",
        "frame": [576, 288], "anchor": [.5, .65],
        "registration": [288,187], "registrationPart": "hull center",
        "sourcePivots": [[233,300],[231,301],[236,300],[233,321],
                         [235,269],[232,267],[229,267],[224,266]],
        "scale": 1.04, "drawWidthCells": 4.2,
        "durationMs": [100,100,100,140,140,100,100,120],
        "names": ["loaded","throttle","accelerate","bank-near",
                  "cut-water","bank-away","level-out","depart"],
        "description": "Eight authored hull/driver/spray drawings; spray is integrated.",
    },
}

manifest = {
    "version": 55, "format": "rgba-webp-atlas", "columns": 4, "rows": 2,
    "loop": False, "payoutAuthority": "recorded event only",
    "alpha": "generated source alpha retained; no chroma key or painted masks",
    "proofType": "offline art inspection, not browser or Pixi renderer evidence",
}
verification = {"version":55, "assets":{}}
proof_frames = {}
for key, cfg in CONFIG.items():
    src = Image.open(ART / cfg["source"]).convert("RGBA")
    fw, fh = cfg["frame"]
    atlas = Image.new("RGBA", (fw*4, fh*2))
    frames, records = [], []
    for index, (name, duration) in enumerate(zip(cfg["names"], cfg["durationMs"])):
        col, row = index % 4, index // 4
        box = [round(col*src.width/4), round(row*src.height/2),
               round((col+1)*src.width/4), round((row+1)*src.height/2)]
        cell = src.crop(box)
        point = cfg["sourcePivots"][index]
        scale = cfg["scale"]
        resized = cell.resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS)
        offset = [round(cfg["registration"][0]-point[0]*scale),
                  round(cfg["registration"][1]-point[1]*scale)]
        frame = Image.new("RGBA", (fw,fh))
        frame.alpha_composite(resized, tuple(offset))
        atlas.alpha_composite(frame,(col*fw,row*fh))
        visible = frame.getchannel("A").point(lambda x:255 if x>16 else 0).getbbox()
        assert visible and min(visible[0],visible[1],fw-visible[2],fh-visible[3]) >= 8, (key,index,visible)
        src_visible = cell.getchannel("A").point(lambda x:255 if x>16 else 0).getbbox()
        assert src_visible and src_visible[0]>0 and src_visible[2]<cell.width, (key,index,"source cropped")
        records.append({
            "index":index,"name":name,"durationMs":duration,
            "rect":[col*fw,row*fh,fw,fh],"sourceCrop":box,
            "sourcePivot":point,"packingOffset":offset,"visibleBounds":list(visible),
        })
        frames.append(frame)
    atlas.save(OUT/cfg["output"], "WEBP",lossless=True,method=6)
    asset = {
        "url":"/kilo-v55/vehicles/"+cfg["output"],
        "size":[fw*4,fh*2],"frame":cfg["frame"],"frameCount":8,
        "anchor":cfg["anchor"],"registration":cfg["registration"],
        "registrationPart":cfg["registrationPart"],"uniformScale":cfg["scale"],
        "suggestedWidthCells":cfg["drawWidthCells"],
        "durationMs":sum(cfg["durationMs"]),"frames":records,
        "description":cfg["description"],"source":cfg["source"],
    }
    if "cargoDropPoint" in cfg: asset["cargoDropPoint"]=cfg["cargoDropPoint"]
    manifest[key] = asset
    frame_hashes=[hashlib.sha256(f.tobytes()).hexdigest() for f in frames]
    assert len(set(frame_hashes))==8
    verification["assets"][key] = {
        "uniqueFrames":len(set(frame_hashes)),
        "sha256":hashlib.sha256((OUT/cfg["output"]).read_bytes()).hexdigest(),
        "frameSha256":frame_hashes,"visibleBounds":[r["visibleBounds"] for r in records],
        "noVisiblePixelsAtCellEdge":True,"registration":"manual source landmark; rigid translation only",
    }
    # Both mobile-scale and desktop-scale inspection, with transparent alpha composited.
    widths=[160,280] if key=="chopper" else [240,360]
    # Contact sheet: four columns / two rows per size.
    ph=sum(2*round(w*fh/fw)+58 for w in widths)
    proof=Image.new("RGB",(max(widths)*4,ph),"#0b2630"); d=ImageDraw.Draw(proof); y=0
    for width in widths:
        height=round(width*fh/fw)
        d.text((8,y+5),f"{key}: {width} x {height}px frame (offline art proof)",fill="#f7eacf")
        for i,frame in enumerate(frames):
            thumb=frame.resize((width,height),Image.Resampling.LANCZOS)
            px=(i%4)*width; py=y+24+(i//4)*(height+14)
            proof.paste(thumb,(px,py),thumb)
            d.text((px+4,py+height),cfg["names"][i],fill="#b7ccd0")
        y+=2*height+58
    proof.save(ART/f"{key}-actual-size-proof.png")
    proof_frames[key]=frames

(OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
(ART/"registration-verification.json").write_text(json.dumps(verification,indent=2)+"\n")

# A neutral-background offline filmstrip: 30 fps, real frame holds, finite actions.
# No added runtime pose deformation; only the eight original authored drawings.
proof_tmp = tempfile.TemporaryDirectory(prefix="kilo-v55-vehicle-proof-")
animation = Path(proof_tmp.name)
for n in range(90):
    progress=(n%45)/45
    canvas=Image.new("RGB",(960,540),"#0b2630")
    d=ImageDraw.Draw(canvas)
    d.text((20,14),"V55 VEHICLE ASSET PROOF — offline frames, not live gameplay",fill="#f7eacf")
    for key, x, y, width in [("chopper",70,65,400),("boat",470,165,440)]:
        cfg=CONFIG[key]; total=sum(cfg["durationMs"])
        target=min(total-1,progress*total); cumulative=0; idx=7
        for i,ms in enumerate(cfg["durationMs"]):
            cumulative+=ms
            if target<cumulative: idx=i; break
        f=proof_frames[key][idx]
        f=f.resize((width,round(width*f.height/f.width)),Image.Resampling.LANCZOS)
        canvas.paste(f,(x,y),f)
        d.text((x,y+f.height+18),cfg["names"][idx],fill="#b7ccd0")
    canvas.save(animation/f"{n:03}.png")
subprocess.run([
    "ffmpeg","-loglevel","error","-y","-framerate","30","-i",str(animation/"%03d.png"),
    "-c:v","libx264","-pix_fmt","yuv420p","-crf","20","-movflags","+faststart",
    str(ART/"vehicle-animation-proof.mp4")
],check=True)
proof_tmp.cleanup()
print(json.dumps({"packed":[v["url"] for k,v in manifest.items() if isinstance(v,dict) and "url" in v],"verification":verification},indent=2))
