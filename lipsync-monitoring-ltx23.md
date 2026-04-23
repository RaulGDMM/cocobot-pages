# Lip-Sync Monitoring Report - LTX 2.3

**Generated:** 2026-03-10 23:00 (Europe/Madrid)
**Status:** 🟡 Monitoring Active

---

## 📊 **Current Status (March 10, 2026)**

### **Lightricks LTX-2.3 Collection**
**URL:** https://huggingface.co/collections/Lightricks/ltx-23

**Last updated:** 1 day ago (as of March 10, 2026)

**Available IC-LoRAs:**
1. ✅ **LTX-2.3-22b-IC-LoRA-Union-Control** - Updated 4 days ago
   - Any-to-Any control
   - NOT lip-sync related
   
2. ✅ **LTX-2.3-22b-IC-LoRA-Motion-Track-Control** - Updated 2 days ago
   - Motion tracking control
   - NOT lip-sync related

**❌ NO lip-sync IC-LoRA published yet for LTX-2.3**

---

### **JustDubit Project**
**URL:** https://huggingface.co/justdubit/justdubit

**Status:** ⚠️ **Only compatible with LTX-2 (19B), NOT LTX-2.3 (22B)**

**Current version:** `ltx-2-19b-ic-lora-lipdubbing.safetensors`
- Base model required: `ltx-2-19b-dev.safetensors` (LTX-2, NOT LTX-2.3)
- Last activity: 22 days ago (per HuggingFace commit history)

**Limitations:**
- ❌ **NOT compatible with LTX-2.3-22b**
- ❌ Trained on human faces only (per documentation)
- ⚠️ Works best with spoken dialogue (voiceover), NOT music/singing
- ⚠️ Requires LTX-2 base model (older version)

**Key quote from docs:**
> "A LoRA adapter for the LTX-2 audio-visual foundation model that enables high-quality video dubbing with synchronized lip movements and speech"

---

### **Alternative Lip-Sync Solutions for Non-Human Characters**

#### **Commercial/Paid Tools:**

| Tool | URL | Non-Human Support | Status |
|------|-----|-------------------|--------|
| **LipSync Video** | lipsync.video | ✅ Pets/animals | Paid tool, not open-source |
| **DreamFace** | dreamfaceapp.com | ✅ Pets/animals | Paid, not open-source |
| **LipSync Studio** | lipsync.studio | ✅ Animals/cartoons | Paid, not open-source |
| **DZine AI** | dzine.ai | ✅ Fantasy creatures | Paid, claims "adapts to all facial structures" |

**All commercial tools are:**
- ❌ Not open-source
- ❌ API-only or web-based
- ❌ Not integrable with local ComfyUI workflows

#### **Open-Source Alternatives:**

| Tool | Compatibility | Non-Human Support |
|------|---------------|-------------------|
| **Wav2Lip** | ❌ Not LTX-2.3 | ❌ Humans only |
| **SadTalker** | ❌ Not LTX-2.3 | ❌ Humans only |
| **LivePortrait** | ❌ Not LTX-2.3 | ⚠️ Limited furry support |
| **JustDubit** | ❌ LTX-2 only | ❌ Humans only |

---

## 🎯 **Key Findings**

### **1. LTX-2.3 Lip-Sync Status**
- ❌ **NO official lip-sync IC-LoRA from Lightricks for LTX-2.3**
- ✅ Lightricks is actively publishing IC-LoRAs (Motion Track, Union Control)
- ⚠️ Lip-sync may be in development (not announced)

### **2. JustDubit Compatibility**
- ❌ **ONLY works with LTX-2 (19B), NOT LTX-2.3 (22B)**
- ⚠️ Requires older base model (`ltx-2-19b-dev.safetensors`)
- ❌ No announcement of LTX-2.3 version

### **3. Non-Human Character Support**
- ❌ **NO open-source lip-sync for furry/animal characters with LTX-2.3**
- ✅ Commercial tools exist (DZine, DreamFace, etc.) but are not open-source
- ⚠️ LTX-2.3 native lip-sync works ~70-80% with singing (limited)

---

## 📅 **Monitoring Plan**

### **Sources to Watch:**

1. **Lightricks LTX-2.3 Collection**
   - https://huggingface.co/collections/Lightricks/ltx-23
   - Check for new IC-LoRAs
   - Keywords: "lip", "sync", "dub", "audio", "voice"

2. **JustDubit Repository**
   - https://huggingface.co/justdubit/justdubit
   - https://github.com/justdubit/just-dub-it
   - Check for LTX-2.3 compatibility updates

3. **Lightricks GitHub**
   - https://github.com/Lightricks/LTX-2
   - Check for new pipelines or LoRA announcements

4. **Reddit r/StableDiffusion**
   - Monitor for community discoveries
   - Keywords: "LTX-2.3 lip sync", "LTX lipdub"

---

## 🔍 **Search Queries for Future Monitoring**

```
"Lightricks LTX-2.3" "lip sync" OR "lipdubbing" OR "IC-LoRA"
"JustDubit" "LTX-2.3" OR "22B" compatible
"LTX-2.3" "audio" "lip" HuggingFace
"furry lip sync" "AI" "open source" 2026
"non-human lip sync" "LTX" ComfyUI
```

---

## 📝 **Summary for User**

**Current situation (March 10, 2026):**

- ❌ **NO lip-sync IC-LoRA for LTX-2.3 yet**
- ❌ **JustDubit only works with LTX-2 (older version)**
- ⚠️ **LTX-2.3 native lip-sync = ~70-80% with singing** (limited)
- ✅ **Commercial tools exist but are NOT open-source**

**Recommendation:**
1. Continue monitoring Lightricks collection for new IC-LoRAs
2. Wait for JustDubit to release LTX-2.3 version (if announced)
3. Use current LTX-2.3 native audio sync for now (accept limitations)
4. Consider commercial tools (DZine AI) if non-human lip-sync is critical

**Next check:** Daily (integrated with AI news updates)

---

**Last updated:** 2026-03-10 23:00 (Europe/Madrid)
**Next scheduled check:** 2026-03-11 10:00 (with daily AI news)
