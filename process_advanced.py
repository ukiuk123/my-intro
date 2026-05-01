import cv2
import numpy as np
import os

def remove_green_background(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"{input_path} not found.")
        return
        
    try:
        img = cv2.imread(input_path)
        if img is None:
            print(f"Failed to read {input_path}")
            return
            
        # HSV色空間に変換して緑色を正確に捉える
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # 緑色の範囲（ノイズも含めて広めに設定）
        lower_green = np.array([35, 40, 40])
        upper_green = np.array([90, 255, 255])
        
        # 緑色のマスクを作成
        mask = cv2.inRange(hsv, lower_green, upper_green)
        
        # ノイズ除去（モルフォロジー演算）
        kernel = np.ones((3,3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # エッジを滑らかにするためのブラー
        mask = cv2.GaussianBlur(mask, (3, 3), 0)
        
        # BGRA（アルファチャンネル付き）に変換
        bgra = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        
        # マスクを使って透明化（緑のマスク部分のアルファを0にする）
        # 滑らかなマスクを使用するため、アルファ値をマスクの反転値にする
        inv_mask = cv2.bitwise_not(mask)
        bgra[:, :, 3] = inv_mask
        
        # 緑色のエッジが残らないよう、RGB値を黒または周囲の色になじませる処理
        # ここでは完全に透明なピクセルは色情報を0にする
        bgra[mask > 200, 0:3] = 0
        
        cv2.imwrite(output_path, bgra)
        print(f"Successfully processed {input_path} -> {output_path}")
    except Exception as e:
        print(f"Error processing {input_path}: {e}")

remove_green_background("hero_char.png", "hero_char_transparent2.png")
remove_green_background("boss_char.png", "boss_char_transparent2.png")
