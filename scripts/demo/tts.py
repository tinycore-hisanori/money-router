import json, re, sys, soundfile as sf
from kokoro_onnx import Kokoro
src = open('/tmp/claude-0/rec/record.mjs').read()
caps = [c for c in re.findall(r"caption\('((?:[^'\\]|\\.)*)'", src) if c]
def spoken(t):
    t = t.replace("\\'", "'").replace('→', ', so it is').replace('×', 'times').replace('$/hour', 'dollars per hour')
    t = t.replace('50+', 'fifty-plus').replace('(sandbox)', 'in the sandbox').replace('…', '').replace('—', ',').replace('"', '')
    t = t.replace('itch.io', 'itch dot io').replace('PayPal-payable', 'PayPal payable')
    return re.sub(r'\s+', ' ', t).strip()
k = Kokoro('scripts/demo/tts/kokoro.onnx', 'scripts/demo/tts/voices.bin')
out = {}
for i, c in enumerate(caps):
    s, sr = k.create(spoken(c), voice='am_michael', speed=1.12, lang='en-us')
    f = f'scripts/demo/tts/clips/{i:02d}.wav'; sf.write(f, s, sr)
    out[c.replace("\\'", "'")] = {'file': f, 'dur': round(len(s)/sr, 2)}
    print(f'{len(s)/sr:5.1f}s', spoken(c))
json.dump(out, open('scripts/demo/tts/clips.json', 'w'), ensure_ascii=False, indent=1)
print('total', sum(v['dur'] for v in out.values()))
