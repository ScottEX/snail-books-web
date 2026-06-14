import React from 'react';
import { View, Text, TouchableOpacity, Image, LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';
import { useCallback, useRef, useState } from 'react';

interface Props {
  /** Existing image URLs (from server) */
  existingImages?: string[];
  /** Newly added File objects */
  newFiles?: File[];
  onAdd: (files: File[]) => void;
  onRemoveExisting?: (index: number) => void;
  onRemoveNew?: (index: number) => void;
  getPreviewUrl?: (file: File) => string;
  /** Max thumbnail size in px (default 120), actual size auto-calculated to fill row */
  maxThumbSize?: number;
  /** Label text override (default: 凭证上传) */
  label?: string;
  /** Accept attribute for file input (default: image/jpeg,image/png,image/webp) */
  accept?: string;
}

const GAP = 8;
const MAX_IMAGES = 9;

export default function ReceiptUpload({
  existingImages = [],
  newFiles = [],
  onAdd,
  onRemoveExisting,
  onRemoveNew,
  getPreviewUrl,
  maxThumbSize = 120,
  label,
  accept,
}: Props) {
  const { colors: c } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTip, setShowTip] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showMaxHint, setShowMaxHint] = useState(false);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContainerWidth(w);
  }, []);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const arr: File[] = [];
    for (let i = 0; i < files.length; i++) arr.push(files[i]);
    const available = MAX_IMAGES - existingImages.length - newFiles.length;
    if (arr.length > available) {
      onAdd(arr.slice(0, available));
      setShowMaxHint(true);
      setTimeout(() => setShowMaxHint(false), 3000);
    } else {
      onAdd(arr);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const atMax = existingImages.length + newFiles.length >= MAX_IMAGES;
  const totalItems = atMax ? existingImages.length + newFiles.length : 1 + existingImages.length + newFiles.length; // +1 for add button (hidden at max)
  const itemsPerRow = Math.min(totalItems, 4);
  const thumbSize = containerWidth > 0
    ? Math.min(maxThumbSize, (containerWidth - GAP * (itemsPerRow - 1)) / itemsPerRow)
    : maxThumbSize;

  return (
    <View onLayout={onLayout}>
      {/* Label + info tip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: c.textSub, marginBottom: 0 }}>
          {label || t('uploadImage')}
        </Text>
        <TouchableOpacity
          onPress={() => setShowTip(!showTip)}
          activeOpacity={0.7}
          style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: c.secondary, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: c.textSub }}>!</Text>
        </TouchableOpacity>
        {showTip && (
          <View style={{ backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ fontSize: FONTS.micro.size, color: c.surface, fontWeight: '500' as const }}>
              支持 jpg/png/webp，单张最大 10MB
            </Text>
          </View>
        )}
      </View>

      {/* Hidden file input */}
      {React.createElement('input', {
        ref: fileInputRef,
        type: 'file',
        accept: accept || 'image/jpeg,image/png,image/webp',
        multiple: true,
        onChange: handleFilePick,
        style: { display: 'none' },
      })}

      {/* Add button + previews */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {/* Add button — hidden when max reached */}
        {!atMax && (
        <TouchableOpacity
          style={{
            width: thumbSize, height: thumbSize,
            borderRadius: 8,
            borderWidth: 1.5, borderStyle: 'dashed' as any,
            borderColor: c.secondary,
            backgroundColor: c.surface,
            alignItems: 'center' as const, justifyContent: 'center' as const,
            gap: 4,
          }}
          onPress={() => fileInputRef.current?.click()}
          activeOpacity={0.7}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.textSub} strokeWidth={1.5} strokeLinecap="round">
            <Path d="M12 5v14M5 12h14" />
          </Svg>
          <Text style={{ fontSize: 10, color: c.textSub }}>{totalItems === 1 ? t('uploadImage') : ''}</Text>
        </TouchableOpacity>
        )}

        {/* Existing image previews */}
        {existingImages.map((url: string, i: number) => (
          <View key={`existing-${i}`} style={{ position: 'relative' }}>
            <Image source={{ uri: url }} style={{ width: thumbSize, height: thumbSize, borderRadius: 8 }} />
            {onRemoveExisting && (
              <TouchableOpacity
                onPress={() => onRemoveExisting(i)}
                activeOpacity={0.7}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                  <Path d="M18 6L6 18M6 6l12 12" />
                </Svg>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* New file previews */}
        {newFiles.map((file: File, i: number) => (
          <View key={`new-${i}`} style={{ position: 'relative' }}>
            {getPreviewUrl ? (
              <Image source={{ uri: getPreviewUrl(file) }} style={{ width: thumbSize, height: thumbSize, borderRadius: 8 }} />
            ) : (
              <View style={{ width: thumbSize, height: thumbSize, borderRadius: 8, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, color: c.textSub }}>{file.name}</Text>
              </View>
            )}
            {onRemoveNew && (
              <TouchableOpacity
                onPress={() => onRemoveNew(i)}
                activeOpacity={0.7}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                  <Path d="M18 6L6 18M6 6l12 12" />
                </Svg>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Max limit hint */}
      {showMaxHint && (
        <Text style={{ fontSize: FONTS.micro.size, color: c.danger, marginTop: 4 }}>
          最多{MAX_IMAGES}张
        </Text>
      )}
    </View>
  );
}
