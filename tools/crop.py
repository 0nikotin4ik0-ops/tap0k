# Crop a rendered page to the frame area (device pixels).
# usage: python crop.py <src.png> <dst.png> <cssW> <cssH> [dpr]
import sys
from PIL import Image

src, dst, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
dpr = int(sys.argv[5]) if len(sys.argv) > 5 else 2

im = Image.open(src)
box = (0, 0, min(im.size[0], w * dpr), min(im.size[1], h * dpr))
out = im.crop(box)
out.save(dst)
status = 'ok' if box[2] == w * dpr and box[3] == h * dpr else 'CLIPPED'
print('%s %s raw=%dx%d want=%dx%d got=%dx%d' % (status, dst, im.size[0], im.size[1], w * dpr, h * dpr, box[2], box[3]))
