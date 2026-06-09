import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { t } from '../i18n';

interface Props {
  /** Existing image URLs (from server) */
  existingImages?: string[];
  /** Newly added File objects */
  newFiles?: File[];
  onAdd: (files: File[]) => void;
  onRemoveExisting?: (index: number) => void;
  onRemoveNew?: (index: number) => void;
  getPreviewUrl?: (file: File) => string;
  /** Thumbnail size in px (default 92) */
  thumbSize?: number;
}

export default function ReceiptUpload({
  existingImages = [],
  newFiles = [],
  onAdd,
  onRemoveExisting,
  onRemoveNew,
  getPreviewUrl,
  thumbSize = 92,
}: Props) {
  const { colors: c } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const arr: File[] = [];
    for (let i = 0; i < files.length; i++) arr.push(files[i]);
    onAdd(arr);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasAny = existingImages.length > 0 || newFiles.length > 0;

  return (
    <View>
      {/* Hidden file input */}
      {React.createElement('input', {
        ref: fileInputRef,
        type: 'file',
        accept: 'image/jpeg,image/png,image/webp',
        multiple: true,
        onChange: handleFilePick,
        style: { display: 'none' },
      })}

      {/* Add button + previews */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {/* Add button */}
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
          <Text style={{ fontSize: 10, color: c.textSub }}>{hasAny ? '' : t('uploadImage')}</Text>
        </TouchableOpacity>

        {/* Existing image previews */}
        {existingImages.map((url: string, i: number) => (
          <View key={`existing-${i}`} style={{ position: 'relative' }}>
            <Image source={{ uri: url }} style={{ width: thumbSize, height: thumbSize, borderRadius: 8 }} />
            {onRemoveExisting && (
              <TouchableOpacity onPress={() => onRemoveExisting(i)} activeOpacity={0.7}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
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
              <TouchableOpacity onPress={() => onRemoveNew(i)} activeOpacity={0.7}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                  <Path d="M18 6L6 18M6 6l12 12" />
                </Svg>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
