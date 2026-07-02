import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { sheetHandle } from '../sharedStyles';
import { FONTS } from '../theme';

interface Props {
  title: string;
  onClose: () => void;
  /** 标题栏文字颜色，默认 surface (白色) */
  titleColor?: string;
  /** 标题栏背景色，默认不设（由调用方外层控制） */
}

/** 底部 sheet 抽屉统一头部：灰色把手 + 标题 + 关闭按钮 */
export default function SheetHeader({ title, onClose, titleColor = '#fff' }: Props) {
  return (
    <View style={{ width: '100%' }}>
      <View style={sheetHandle} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: titleColor }}>{title}</Text>
        <TouchableOpacity style={{ padding: 4 }} onPress={onClose}>
          <Svg width="18" height="18" viewBox="0 0 24 24" stroke={titleColor} strokeWidth="2" fill="none">
            <Line x1="18" y1="6" x2="6" y2="18" />
            <Line x1="6" y1="6" x2="18" y2="18" />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
}
