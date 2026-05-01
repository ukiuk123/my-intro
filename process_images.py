from PIL import Image
import os

def make_transparent(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"{input_path} not found.")
        return
    
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()

        newData = []
        for item in datas:
            # 緑色の判定条件（少し緩めに設定）
            if item[1] > 130 and item[0] < 130 and item[2] < 130 and item[1] > item[0] * 1.2 and item[1] > item[2] * 1.2:
                newData.append((item[0], item[1], item[2], 0))
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Successfully processed {input_path} -> {output_path}")
    except Exception as e:
        print(f"Error processing {input_path}: {e}")

make_transparent("hero_char.png", "hero_char_transparent.png")
make_transparent("boss_char.png", "boss_char_transparent.png")
