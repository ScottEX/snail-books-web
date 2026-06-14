import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import Svg, { Path, Polyline, Line, Circle, Rect } from 'react-native-svg';
import { t } from '../i18n';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useEffect, useRef, useState } from 'react';
import { FONTS } from '../theme';
import { useSwipeBack } from '../hooks/useSwipeBack';

/* ═══════════════ SVG ICONS ═══════════════ */

const IcnBack = ({ color }: { color: string }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24">
    <Polyline points="15 18 9 12 15 6" stroke={color} strokeWidth="2.2" fill="none" />
  </Svg>
);
const IcnDoc = ({ color }: { color: string }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <Polyline points="14 2 14 8 20 8" />
    <Line x1="16" y1="13" x2="8" y2="13" />
    <Line x1="16" y1="17" x2="8" y2="17" />
    <Polyline points="10 9 9 9 8 9" />
  </Svg>
);
const IcnPlus = ({ color }: { color: string }) => (
  <Svg width="14" height="14" viewBox="0 0 24 24" stroke={color} strokeWidth="2" fill="none">
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);
const IcnCompany = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <Polyline points="9 22 9 12 15 12 15 22" />
  </Svg>
);
const IcnTax = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Circle cx="12" cy="12" r="10" />
    <Line x1="12" y1="8" x2="12" y2="12" />
    <Line x1="12" y1="16" x2="12.01" y2="16" />
  </Svg>
);
const IcnAddr = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <Circle cx="12" cy="10" r="3" />
  </Svg>
);
const IcnBank = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Rect x="2" y="5" width="20" height="14" rx="2" />
    <Line x1="2" y1="10" x2="22" y2="10" />
  </Svg>
);
const IcnMail = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <Polyline points="22,6 12,13 2,6" />
  </Svg>
);
const IcnPhone = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
  </Svg>
);
const IcnAccount = ({ color }: { color: string }) => (
  <Svg width="15" height="15" viewBox="0 0 24 24" stroke={color} strokeWidth="1.8" fill="none">
    <Line x1="12" y1="1" x2="12" y2="23" />
    <Path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </Svg>
);
const IcnDownloadSmall = ({ color }: { color: string }) => (
  <Svg width="12" height="12" viewBox="0 0 24 24" stroke={color} strokeWidth="2" fill="none">
    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <Polyline points="7 10 12 15 17 10" />
    <Line x1="12" y1="15" x2="12" y2="3" />
  </Svg>
);
const IcnShareSmall = ({ color }: { color: string }) => (
  <Svg width="12" height="12" viewBox="0 0 24 24" stroke={color} strokeWidth="2" fill="none">
    <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <Polyline points="16 6 12 2 8 6" />
    <Line x1="12" y1="2" x2="12" y2="15" />
  </Svg>
);
const IcnClose = () => (
  <Svg width="14" height="14" viewBox="0 0 1088 1024">
    <Path d="M843.712 191.936l-6.08-5.568-5.184-3.84-5.696-3.328a67.712 67.712 0 0 0-80.448 11.264L520.768 416.064l-224.64-224.64-2.688-2.56c-27.968-24.32-68.224-24.256-92.672 0.128l-4.8 5.12-4.608 6.144-3.392 5.632a67.84 67.84 0 0 0 11.328 80.512L424.96 512l-227.2 227.328c-24.32 28.16-24.32 68.48 0 92.864l5.12 4.8 6.208 4.608 5.632 3.392c26.816 14.336 59.136 9.984 80.448-11.328l225.6-225.728 227.072 227.2c28.608 24.832 68.928 24 94.336-1.472l4.544-5.056 4.096-5.568a67.84 67.84 0 0 0-8.64-85.312L616.64 512.064l224.512-224.64 4.16-4.352c23.04-26.752 22.4-67.008-1.6-91.136z" fill="rgba(255,255,255,0.7)" />
  </Svg>
);

/** Pen icon — same SVG as UserDetailScreen.PencilSvg */
const PencilSvg = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="M15 5l4 4" />
  </svg>
);

/** Stamp seal — rejected (作废) */
const IcnSealRejected = ({ color }: { color: string }) => (
  <svg width="48" height="48" viewBox="0 0 1029 1024" fill="none">
    <path d="M1020.835581 368.09697L864.649723 121.793939C850.944672 100.331313 822.500228 93.99596 800.908309 107.442424L21.401238 600.565657c-21.462626 13.705051-27.79798 42.149495-14.351515 63.612121L163.364874 910.480808c13.705051 21.462626 42.149495 27.79798 63.612122 14.222222l779.50707-493.123232c21.462626-13.575758 27.927273-42.020202 14.351515-63.482828z m-31.159596 37.10707L210.168915 898.327273c-6.852525 4.39596-15.90303 2.327273-20.29899-4.525253L33.684066 647.49899c-4.39596-6.852525-2.327273-15.90303 4.525253-20.29899l779.50707-493.123232c6.852525-4.266667 15.90303-2.327273 20.169697 4.654545l156.185859 246.30303c4.39596 6.593939 2.456566 15.644444-4.39596 20.169697zM317.740632 248.888889l12.929293 31.030303 16.808081-29.090909 33.486868-2.715152-22.626262-24.953535 7.628283-32.711111-30.513132 13.834343-28.832323-17.454545 3.620202 33.486869-25.470707 21.721212 32.969697 6.852525zM516.205278 156.444444l-16.161616-29.60808-13.575757 30.90101-33.09899 6.335353 24.953535 22.367677-4.266667 33.357576 29.220202-16.808081 30.383839 14.480808-6.981818-32.969697 23.014141-24.436364-33.486869-3.620202z m302.545455 495.19192l-26.634344-20.428283-0.129292 33.616161-27.79798 18.876768 32.064646 10.60202 9.438384 32.19394 19.911111-27.151515 33.616162 0.90505-19.781818-27.280808 11.377777-31.547475-32.064646 10.214142zM710.015379 785.454545l-12.670707-31.159596-17.066666 28.961617-33.486869 2.456565 22.367677 25.082829-8.016162 32.581818 30.771717-13.446465 28.703031 17.842424-3.361617-33.486868 25.470708-21.721212-32.711112-7.111112z m-199.240404 91.022223l15.903031 29.737373 13.963636-30.642424 33.09899-5.947475-24.824243-22.755555 4.525253-33.357576-29.349495 16.549495-30.254545-14.610101 6.723232 32.840404-23.272727 24.436364 33.486868 3.749495zM212.366895 378.957576l26.50505 20.816161 0.387879-33.616161 27.927273-18.747475-31.935354-10.731313-9.179798-32.323232-20.169697 26.892929-33.616162-1.163637 19.523233 27.410101-11.636364 31.547475 32.19394-10.084848z m-118.303031 145.066666c-3.490909-142.222222 65.680808-282.892929 194.585859-364.347474S574.257804 75.894949 701.611339 139.765657l30.771717-19.39394c-37.624242-21.074747-78.222222-36.460606-120.888889-46.028283-57.018182-12.8-115.070707-14.480808-172.476767-5.042424-59.474747 9.826263-115.717172 31.288889-167.046465 63.870707-51.329293 32.581818-94.771717 74.084848-129.163636 123.604041-33.228283 47.709091-56.630303 100.977778-69.430303 157.866666-9.567677 42.666667-12.929293 85.850505-9.955556 128.905051l30.642424-19.523232zM931.106288 502.30303c3.620202 142.222222-65.551515 282.892929-194.327272 364.347475-128.905051 81.583838-285.608081 83.911111-412.832323 20.040404l-30.771718 19.523232c37.624242 20.945455 78.222222 36.460606 120.888889 46.028283 57.018182 12.8 115.070707 14.480808 172.476768 5.042424 59.474747-9.826263 115.717172-31.288889 166.917172-63.741414 51.329293-32.581818 94.771717-74.084848 129.163636-123.60404 33.09899-47.838384 56.50101-100.977778 69.30101-157.866667 9.567677-42.666667 12.929293-85.850505 9.955556-128.90505L931.106288 502.30303zM381.482046 306.424242c36.072727-22.755556 75.765657-34.909091 115.717172-37.365656l47.579798-30.125253c-62.836364-7.369697-125.80202 6.723232-180.105051 40.985859-54.173737 34.262626-93.866667 85.20404-114.036363 145.066667l47.579798-30.125253c19.264646-35.038384 47.191919-65.680808 83.264646-88.436364z m262.206061 413.608081c-36.072727 22.884848-75.765657 35.038384-115.587879 37.365657l-47.579798 30.125252c62.836364 7.369697 125.80202-6.723232 180.10505-41.115151 54.173737-34.262626 93.866667-85.20404 114.036364-145.066667l-47.579798 30.125253c-19.264646 35.038384-47.321212 65.680808-83.393939 88.565656z m0 0" fill={color} />
    <path d="M136.213359 648.274747l139.765657-87.789899 1.680808-14.351515 23.272727 0.905051-5.042424 10.989899c20.040404 31.935354 33.616162 52.751515 40.59798 62.448485l-11.377778 13.834343-7.49899-12.024242-121.535354 76.412121 43.701011 69.430303c4.654545 8.921212 12.670707 9.567677 23.789899 1.810101l114.812121-72.145455c11.765657-6.723232 15.90303-14.351515 12.153535-23.272727-3.749495-8.791919-9.955556-20.816162-18.747475-36.20202l4.783839-2.973737c17.066667 27.151515 30.771717 38.270707 40.985858 33.357575 0.258586 13.187879-8.274747 24.436364-25.470707 33.874748l-133.042424 83.652525C245.853763 795.151515 235.251743 792.565657 227.235581 778.214141c-34.391919-54.820202-54.690909-86.367677-60.638383-94.513131l26.50505-6.593939-4.137374 10.343434 4.008081 6.335354 121.535354-76.412122-33.616162-53.527272L170.863864 633.276768c-8.274747 5.171717-15.515152 10.860606-21.462626 16.80808l-13.187879-1.810101z" fill={color} />
    <path d="M244.81942 797.220202c-9.050505 0-16.678788-5.430303-22.626263-15.90303-34.133333-54.30303-54.432323-85.850505-60.379798-93.99596l-5.171717-6.981818 46.028283-11.507071-6.464647 16.290909 110.286869-69.30101-27.410101-43.70101-105.115151 66.068687c-7.886869 4.913131-14.739394 10.343434-20.428283 16.032323l-2.068687 2.068687-31.935354-4.266667 151.014142-94.90101 1.939394-16.937373 37.365656 1.551515-7.49899 16.032323c19.006061 30.254545 32.064646 50.294949 38.658586 59.474747l2.585859 3.620202-19.264647 23.531314-8.791919-13.834344L203.833561 700.767677 244.560834 765.672727c2.19798 4.008081 4.137374 4.008081 5.171717 4.008081 1.810101 0 4.913131-0.775758 10.084849-4.39596l0.258585-0.129292 115.070708-72.274748c13.187879-7.49899 10.731313-13.317172 9.567676-15.90303-3.620202-8.533333-9.826263-20.428283-18.359596-35.555556l-2.715151-4.783838 14.480808-9.050505 3.10303 4.913131c17.971717 28.70303 27.668687 31.676768 31.030303 31.676768 0.905051 0 1.680808-0.129293 2.456566-0.517172l8.145454-4.008081 0.129293 9.050505c0.387879 15.385859-9.179798 28.573737-28.315151 38.917172l-132.783839 83.393939c-5.818182 4.137374-11.507071 6.206061-17.066666 6.206061z" fill={color} />
    <path d="M492.932551 612.460606c6.723232 10.60202 12.8 19.781818 18.488889 27.410101l-11.248485 16.032323c-10.084848-17.454545-19.006061-32.323232-26.634343-44.476767l-47.709091-75.89495c-2.068687 22.109091-6.206061 42.537374-12.282828 61.155556l-3.878788 0.258586c3.10303-19.006061 4.39596-38.270707 3.878788-57.535354-0.517172-19.264646-1.939394-35.684848-4.137374-49.131313-2.19798-13.446465-4.525253-24.953535-6.981818-34.521212l25.212121-2.456566-4.654546 9.567677c1.551515 25.082828 2.585859 44.476768 3.103031 58.181818l17.971717-1.292929-3.749495 9.050505 52.622222 83.652525z m73.179798-68.266667l16.549495 26.375758c2.973737 4.783838 7.369697 10.989899 13.058586 18.618182l-12.282828 14.480808c-9.438384-16.420202-17.325253-29.608081-23.660606-39.692929l-64.775758-103.046465-13.446465 8.40404c-1.422222 27.539394-5.430303 51.717172-12.024242 72.145455l-3.878788 0.258586c3.620202-26.763636 4.39596-51.458586 2.327273-73.826263-2.068687-22.49697-4.654545-39.046465-7.886869-49.648485l25.729293-1.680808-6.076768 9.438384c0.646465 15.256566 0.905051 27.668687 0.775758 37.365657l76.541414-48.09697 5.947475-18.230303 27.668687 3.749495-82.359596 51.717172 27.151515 43.183838 42.149495-26.505051 5.947475-18.230303 27.668686 3.749495-72.791919 45.769697 24.565657 39.175758 48.872727-30.642424 5.947475-18.230303 27.668687 3.749495-79.385859 49.648484z" fill={color} />
    <path d="M499.655783 666.634343l-4.525252-7.886868c-10.343434-17.842424-19.006061-32.323232-26.505051-44.347475l-38.917171-61.931313c-2.327273 16.290909-5.947475 31.676768-10.602021 46.028283l-1.292929 3.749495-15.127273 0.775757 1.163637-7.111111c3.10303-18.618182 4.39596-37.624242 3.749495-56.50101-0.517172-19.006061-1.939394-35.29697-4.137374-48.355556-2.19798-13.317172-4.525253-24.694949-6.981818-34.133333l-1.680808-6.593939 42.278788-4.137374-8.533334 17.583838c1.292929 21.333333 2.19798 38.141414 2.844445 50.812122l21.333333-1.422223-6.076768 14.868687 12.282829 19.523233 0.90505-6.852526c3.620202-26.246465 4.39596-50.682828 2.327273-72.533333-2.068687-21.979798-4.654545-38.270707-7.628283-48.614141l-2.068687-6.981819 44.476768-2.844444-11.377778 17.583838c0.387879 9.438384 0.646465 17.971717 0.646465 25.212122l65.939394-41.373738 6.723232-20.816161 48.484849 6.593939-91.022223 57.147475 20.945455 33.228283 35.426262-22.238384 6.723233-20.816162 48.484848 6.593939-81.454545 51.2 18.359596 29.349495 42.149495-26.50505 6.723232-20.816162 48.484849 6.59394-88.177778 55.337373 13.446464 21.462627c2.973737 4.654545 7.240404 10.860606 12.8 18.230303l2.844445 3.749495-20.686869 24.177777-4.137374-7.111111c-9.567677-16.678788-17.325253-29.608081-23.531313-39.563636l-61.672727-98.133333-5.947475 3.749495c-1.551515 26.763636-5.559596 50.553535-12.153535 70.723232l-1.292929 3.749495-14.739394 0.775757 38.787878 61.672728c6.593939 10.472727 12.8 19.652525 18.230304 27.022222l2.585858 3.361616-18.876768 26.763636z" fill={color} />
    <path d="M629.336592 342.884848l19.393939-3.232323L724.237602 292.20202c-4.654545-4.525253-9.567677-7.886869-14.99798-10.084848s-11.636364-4.008081-18.747475-5.430303l-0.517172-2.973738c19.006061-5.171717 29.99596-6.723232 33.09899-4.654545 3.10303 2.19798 5.171717 4.008081 6.206061 5.559596 2.327273 3.749495 2.327273 8.533333-0.129293 14.610101l62.189899-39.046465 6.852525-20.945454 30.642424 4.137373L650.799218 345.212121c30.125253 49.389899 47.838384 81.066667 52.880808 94.90101 5.171717 13.834343 8.145455 27.151515 9.050505 39.951515 0.905051 12.8-1.034343 28.056566-5.818182 46.028283l-3.361616-1.163636c2.19798-17.713131 1.292929-34.779798-2.715152-51.2-4.137374-16.420202-14.351515-38.4-30.771717-65.939394-16.549495-27.668687-30.125253-49.260606-40.727272-64.905051z" fill={color} />
  </svg>
);

/** Stamp seal — active (done/pending) */
const IcnSealActive = ({ color }: { color: string }) => (
  <svg width="48" height="48" viewBox="0 0 1166 1024" fill="none">
    <path d="M1158.466731 346.851607l-177.255494-280.206263c-15.483122-24.43339-47.829819-31.666192-72.26969-16.286766L24.30377 611.438647c-24.375061 15.515527-31.581939 47.946477-16.267323 72.315057l177.255494 280.238668c15.476641 24.381542 47.816857 31.601382 72.198399 16.221956l884.670182-561.041183c24.446352-15.528489 31.789331-47.914072 16.306209-72.321538z m-35.308517 42.210787L238.488032 950.174869a16.617298 16.617298 0 0 1-22.994607-5.184804L38.237931 664.744916a16.740437 16.740437 0 0 1 5.197766-23.091822L928.144765 80.573024a16.597855 16.597855 0 0 1 22.962202 5.22369l177.326785 280.238668c4.757058 7.679991 2.417415 17.978309-5.275538 23.027012zM360.544804 211.243053l14.692439 35.321478 19.034713-33.143861 38.024058-3.078477-25.612933-28.412727 8.723433-37.162085-34.757631 15.66459-32.651305-19.812433 4.134882 38.056463-28.963613 24.75744 37.375957 7.809612z m225.25382-105.160792l-18.276435-33.629936-15.476641 35.016871-37.583349 7.193916 28.373841 25.509237-4.893159 37.913881 33.098494-19.183776 34.517834 16.422867-7.971637-37.466691 26.1703-27.797032-37.959248-3.979337z m343.415507 563.361383l-30.24037-23.299214-0.12962 38.199046-31.58842 21.465089 36.377882 12.028746 10.719583 36.68249 22.553899-30.875509 38.16664 1.069365-22.411317-31.037534 12.929606-35.84644-36.377883 11.613961z m-123.437226 152.303624l-14.407275-35.431655-19.345801 33.020721-37.998134 2.760909 25.379617 28.555309-9.034521 37.123198 34.958542-15.314615 32.515204 20.253141-3.823793-38.088868 28.957131-24.718554-37.20097-8.159586z m-226.122274 103.566465l18.11441 33.772518 15.787728-34.913175 37.58335-6.740246-28.205335-25.78792 5.171842-37.881476-33.234595 18.840283-34.349328-16.662665 7.654067 37.395401-26.546197 27.693335 38.030539 4.283945zM240.944333 359.308099l30.071865 23.675112 0.440708-38.23145 31.724521-21.361393-36.170491-12.275024-10.44738-36.850996-22.826101 30.661636-38.173121-1.380454 22.106709 31.180116-13.175884 35.950136 36.449174-11.367683zM106.638461 524.35986c-3.992299-161.850145 74.512118-321.866165 220.775444-414.60935 146.295732-92.743185 324.140998-95.374474 468.602606-22.709443l34.893732-22.126152c-42.748711-23.953795-88.744405-41.478434-137.183438-52.366522a509.523673 509.523673 0 0 0-195.817094-5.67088C430.442446 18.083171 366.649911 42.484156 308.379193 79.503658 250.147361 116.529641 200.768581 163.815056 161.804778 220.160916c-37.719451 54.343229-64.226762 114.875818-78.815505 179.653466-10.862165 48.490881-14.724844 97.649306-11.34176 146.639225l34.997429-22.093747z m950.011677-24.750959c4.167286 161.850145-74.337131 321.866165-220.600458 414.576946-146.263327 92.846882-324.134517 95.406879-468.576681 22.748328l-34.958542 22.152076a509.89309 509.89309 0 0 0 137.228805 52.340599 508.046003 508.046003 0 0 0 195.804132 5.664398c67.480227-11.199177 131.266281-35.567757 189.504594-72.587259 58.231832-37.025983 107.610612-84.317879 146.600339-140.631333a512.543821 512.543821 0 0 0 78.646999-179.646985c10.89457-48.529767 14.692439-97.720598 11.309354-146.710517l-34.958542 22.100228z" fill={color} />
  </svg>
);

/* ═══════════════ INVOICE SCREEN ═══════════════ */

type InvType = 'vat' | 'general' | 'receipt';
type InvStatus = 'done' | 'pending' | 'rejected';

interface InvoiceData {
  company_name: string;
  tax_id: string;
  bank_name: string;
  bank_account: string;
  address: string;
  phone: string;
  email: string;
  inv_type: InvType;
}

interface InvoiceRecord {
  id: number;
  type: InvType;
  company: string;
  tax_id: string;
  date: string;
  invoice_no: string;
  amount: number;
  status: InvStatus;
}

const EMPTY_INV: InvoiceData = {
  company_name: '', tax_id: '', bank_name: '', bank_account: '', address: '', phone: '', email: '', inv_type: 'vat',
};

interface Props {
  onBack: () => void;
}

export default function InvoiceScreen({ onBack }: Props) {
  const { colors: c } = useTheme();
  const swipeBack = useSwipeBack(onBack);
  const [tab, setTab] = useState<number>(0);
  const [invType, setInvType] = useState<InvType>('vat');
  const [data, setData] = useState<InvoiceData>(EMPTY_INV);
  const [orig, setOrig] = useState<InvoiceData>(EMPTY_INV);
  const [loaded, setLoaded] = useState(false);

  // Drawer (apply)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dType, setDType] = useState<InvType>('vat');
  const [dAmount, setDAmount] = useState('');
  const [dDate, setDDate] = useState(new Date().toISOString().slice(0, 10));
  const [dRef, setDRef] = useState('');
  const [dNote, setDNote] = useState('');
  const [dEmail, setDEmail] = useState('');

  // Records stub
  const [records] = useState<InvoiceRecord[]>([
    { id: 1, type: 'vat', company: '柳味探秘科技有限公司', tax_id: '91450000MA5XXXXX12', date: '2026-06-05', invoice_no: 'NO.2026060001', amount: 25600, status: 'done' },
    { id: 2, type: 'general', company: '柳味探秘科技有限公司', tax_id: '91450000MA5XXXXX12', date: '2026-06-07', invoice_no: 'NO.2026060002', amount: 18300, status: 'pending' },
    { id: 3, type: 'vat', company: '柳味探秘科技有限公司', tax_id: '91450000MA5XXXXX12', date: '2026-05-20', invoice_no: 'NO.2026050008', amount: 8500, status: 'rejected' },
  ]);
  const [filter, setFilter] = useState<string>('all');

  // Toast
  const [toast, setToast] = useState('');
  const toastT = useRef<any>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2400);
  };

  // Load invoice data
  useEffect(() => {
    (async () => {
      try {
        const inv = await api.getInvoice();
        if (inv.status === 'ok' && inv.data) {
          const d = { ...EMPTY_INV, ...inv.data };
          setData(d);
          setOrig(d);
          setDEmail(inv.data.email || '');
          setInvType(inv.data.inv_type || 'vat');
        }
      } catch { }
      setLoaded(true);
    })();
  }, []);

  const hasChanged = JSON.stringify(data) !== JSON.stringify(orig);
  const isSaving = useRef(false);

  const handleSaveInfo = async () => {
    if (!hasChanged || isSaving.current) return;
    isSaving.current = true;
    try {
      const json = await api.updateInvoice({ ...data, inv_type: invType } as any);
      if (json.status === 'ok') {
        setOrig({ ...data, inv_type: invType });
        showToast('✅ ' + t('invSaved'));
      }
    } catch { }
    isSaving.current = false;
  };

  // Stats
  const totalCount = records.length;
  const totalAmount = records.reduce((s, r) => s + r.amount, 0);
  const pendingCount = records.filter(r => r.status === 'pending').length;

  // Filtered records
  const filtered = records.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'done') return r.status === 'done';
    if (filter === 'rejected') return r.status === 'rejected';
    if (filter === 'vat') return r.type === 'vat';
    if (filter === 'general') return r.type === 'general';
    return true;
  });

  const FILTERS = [
    { key: 'all', label: t('invFilterAll') },
    { key: 'pending', label: t('invFilterPending') },
    { key: 'done', label: t('invFilterDone') },
    { key: 'rejected', label: t('invFilterRejected') },
    { key: 'vat', label: t('invVatSpecial') },
    { key: 'general', label: t('invGeneral') },
  ];

  const typeBadgeLabel = (tp: InvType) => tp === 'vat' ? t('invVatSpecial') : tp === 'general' ? t('invGeneral') : t('invReceipt');
  const typeBadgeClass = (tp: InvType) => tp === 'vat' ? sBadge.vat : tp === 'general' ? sBadge.general : sBadge.receipt;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]} {...swipeBack}>
      {/* ═══ NAV ═══ */}
      <View style={[s.nav, { backgroundColor: c.bg }]}>
        <TouchableOpacity style={[s.navBtn, { backgroundColor: c.bg }]} onPress={onBack}>
          <IcnBack color={c.textMain} />
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: c.textMain }]}>{t('invTitle')}</Text>
        <View style={s.navRight} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ═══ ENTRY CARD ═══ */}
        <View style={s.entryCard}>
          <View style={s.ecTop}>
            <View>
              <Text style={s.ecLabel}>{t('invLabel')}</Text>
              <Text style={s.ecTitle}>{t('invCenter')}</Text>
            </View>
            <View style={s.ecIcon}>
              <IcnDoc color="rgba(0,0,0,0.45)" />
            </View>
          </View>
          <View style={s.ecStats}>
            <View style={[s.ecStat, { borderRightColor: 'rgba(0,0,0,0.08)' }]}>
              <Text style={s.ecStatNum}>{totalCount}</Text>
              <Text style={s.ecStatLbl}>{t('invTotalCount')}</Text>
            </View>
            <View style={[s.ecStat, { borderRightColor: 'rgba(0,0,0,0.08)' }]}>
              <Text style={s.ecStatNum}>¥{(totalAmount / 10000).toFixed(1)}w</Text>
              <Text style={s.ecStatLbl}>{t('invTotalAmount')}</Text>
            </View>
            <View style={s.ecStat}>
              <Text style={s.ecStatNum}>{pendingCount}</Text>
              <Text style={s.ecStatLbl}>{t('invPending')}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.ecBtn} onPress={() => {
            setDType(invType);
            setDAmount('');
            setDDate(new Date().toISOString().slice(0, 10));
            setDRef('');
            setDNote('');
            setDrawerOpen(true);
          }}>
            <IcnPlus color="rgba(0,0,0,0.45)" />
            <Text style={s.ecBtnText}>{t('invApply')}</Text>
          </TouchableOpacity>
        </View>

        {/* ═══ TABS ═══ */}
        <View style={[s.tabs, { backgroundColor: withAlpha(c.textMain, 0.06) }]}>
          <TouchableOpacity style={[s.tab, tab === 0 && [s.tabOn, { backgroundColor: c.surface, shadowColor: c.textMain }]]} onPress={() => setTab(0)}>
            <Text style={[s.tabText, { color: tab === 0 ? c.textMain : c.textSub }]}>{t('invInfoTab')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, tab === 1 && [s.tabOn, { backgroundColor: c.surface, shadowColor: c.textMain }]]} onPress={() => setTab(1)}>
            <Text style={[s.tabText, { color: tab === 1 ? c.textMain : c.textSub }]}>{t('invRecordsTab')}</Text>
          </TouchableOpacity>
        </View>

        {/* ═══ PANEL 0: INFO ═══ */}
        {tab === 0 && (
          <View>
            {/* Tips */}
            <View style={[s.tips, { backgroundColor: withAlpha(c.warning, 0.08), borderColor: withAlpha(c.warning, 0.2) }]}>
              <Text style={s.tipsIcon}>💡</Text>
              <Text style={[s.tipsText, { color: c.warning }]}>{t('invTips')}</Text>
            </View>

            {/* Invoice type preference — no edit button, chips only */}
            <View style={[s.infoCard, { backgroundColor: c.surface, borderColor: c.secondary }]}>
              <View style={[s.typeToggle, { borderBottomColor: c.secondary }]}>
                {(['vat', 'general', 'receipt'] as InvType[]).map(tp => (
                  <TouchableOpacity key={tp} style={[s.typeChip, invType === tp && { backgroundColor: withAlpha(c.primary, 0.08), borderColor: c.primary }]} onPress={() => setInvType(tp)}>
                    <Text style={[s.typeChipText, { color: invType === tp ? c.primary : c.textSub }]}>{tp === 'vat' ? t('invVatSpecialFull') : tp === 'general' ? t('invGeneralFull') : t('invReceipt')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Header info — no edit button in section head; pencil on each row */}
            <View style={[s.infoCard, { backgroundColor: c.surface, borderColor: c.secondary }]}>
              <EditableInfoRow icon={<IcnCompany color={c.info} />} iconBg={withAlpha(c.info, 0.1)} label={t('companyName')} value={data.company_name} colors={c} onChange={(v) => setData({ ...data, company_name: v })} />
              <EditableInfoRow icon={<IcnTax color={c.warning} />} iconBg={withAlpha(c.warning, 0.1)} label={t('taxId')} value={data.tax_id} colors={c} mono onChange={(v) => setData({ ...data, tax_id: v })} />
              <EditableInfoRow icon={<IcnAddr color={c.success} />} iconBg={withAlpha(c.success, 0.1)} label={t('addressPhone')} value={data.address} colors={c} onChange={(v) => setData({ ...data, address: v })} />
              <EditableInfoRow icon={<IcnPhone color="#2E8B4A" />} iconBg="#EAF8EE" label={t('companyPhone')} value={data.phone} colors={c} mono onChange={(v) => setData({ ...data, phone: v })} />
            </View>

            {/* Bank info */}
            <View style={[s.infoCard, { backgroundColor: c.surface, borderColor: c.secondary }]}>
              <EditableInfoRow icon={<IcnBank color={c.primary} />} iconBg={withAlpha(c.primary, 0.08)} label={t('bankName')} value={data.bank_name} colors={c} onChange={(v) => setData({ ...data, bank_name: v })} />
              <EditableInfoRow icon={<IcnAccount color={c.primary} />} iconBg={withAlpha(c.primary, 0.08)} label={t('bankAccount')} value={data.bank_account} colors={c} mono onChange={(v) => setData({ ...data, bank_account: v })} />
            </View>

            {/* Email */}
            <View style={[s.infoCard, { backgroundColor: c.surface, borderColor: c.secondary }]}>
              <EditableInfoRow icon={<IcnMail color="#7B52AB" />} iconBg="#F0EAF8" label={t('invEmail')} value={data.email} colors={c} onChange={(v) => setData({ ...data, email: v })} />
            </View>
          </View>
        )}

        {/* ═══ PANEL 1: RECORDS ═══ */}
        {tab === 1 && (
          <View>
            {/* Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
              {FILTERS.map(f => (
                <TouchableOpacity key={f.key} style={[s.fc, { backgroundColor: c.surface, borderColor: c.secondary }, filter === f.key && { backgroundColor: c.primary, borderColor: c.primary }]} onPress={() => setFilter(f.key)}>
                  <Text style={[s.fcText, { color: filter === f.key ? '#fff' : c.textSub }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Invoice cards */}
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📄</Text>
                <Text style={[s.emptyText, { color: c.textSub }]}>{t('invEmpty')}</Text>
              </View>
            ) : (
              filtered.map(r => (
                <View key={r.id} style={[s.invCard, { backgroundColor: c.surface, borderColor: c.secondary }]}>
                  {/* Torn edge */}
                  <View style={[s.invTorn, { backgroundColor: c.primary }]} />
                  <View style={[s.invTop, { borderBottomColor: c.secondary }]}>
                    <View style={[s.invBadge, typeBadgeClass(r.type)]}>
                      <Text style={[s.invBadgeText, { color: r.type === 'vat' ? c.primary : r.type === 'general' ? c.info : c.success }]}>{typeBadgeLabel(r.type)}</Text>
                    </View>
                    <View style={s.invMain}>
                      <Text style={[s.invCompany, { color: c.textMain }]} numberOfLines={1}>{r.company}</Text>
                      <Text style={[s.invTax, { color: c.textSub }]}>{r.tax_id}</Text>
                      <View style={s.invMeta}>
                        <Text style={[s.invDate, { color: c.textSub }]}>{r.date}</Text>
                        <Text style={{ color: c.secondary }}>·</Text>
                        <Text style={[s.invNo, { color: c.textSub }]}>{r.invoice_no}</Text>
                      </View>
                    </View>
                    <View style={s.invSealWrap}>
                      {r.status === 'rejected' ? (
                        <IcnSealRejected color="#C0392B" />
                      ) : r.status === 'done' ? (
                        <IcnSealActive color={c.success} />
                      ) : (
                        <IcnSealActive color={c.warning} />
                      )}
                    </View>
                  </View>
                  <View style={s.invBottom}>
                    <View>
                      <Text style={[s.invAmount, { color: r.status === 'rejected' ? c.textSub : c.primary }]}>¥{r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                      <Text style={[s.invAmountLabel, { color: c.textSub }]}>{r.status === 'pending' ? t('invApplyAmount') : r.status === 'done' ? t('invTaxAmount') : t('invStatusRejected')}</Text>
                    </View>
                    <View style={s.invActions}>
                      {r.status === 'done' ? (
                        <>
                          <TouchableOpacity style={[s.invActBtn, { backgroundColor: withAlpha(c.textMain, 0.06), borderColor: c.secondary }]} onPress={() => showToast('⬇️ ' + t('invDownloading'))}>
                            <IcnDownloadSmall color={c.textSub} />
                            <Text style={[s.invActBtnText, { color: c.textSub }]}>{t('invDownload')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[s.invActBtn, { backgroundColor: withAlpha(c.primary, 0.08), borderColor: withAlpha(c.primary, 0.2) }]} onPress={() => showToast('↗️ ' + t('invShareToast'))}>
                            <IcnShareSmall color={c.primary} />
                            <Text style={[s.invActBtnText, { color: c.primary }]}>{t('share')}</Text>
                          </TouchableOpacity>
                        </>
                      ) : r.status === 'pending' ? (
                        <>
                          <View style={[s.invActBtn, { backgroundColor: withAlpha(c.textMain, 0.06), borderColor: c.secondary, opacity: 0.4 }]}>
                            <IcnDownloadSmall color={c.textSub} />
                            <Text style={[s.invActBtnText, { color: c.textSub }]}>{t('invDownload')}</Text>
                          </View>
                          <TouchableOpacity style={[s.invActBtn, { backgroundColor: withAlpha(c.warning, 0.08), borderColor: withAlpha(c.warning, 0.2) }]} onPress={() => showToast('📞 ' + t('invContact'))}>
                            <Text style={[s.invActBtnText, { color: c.warning }]}>{t('invUrge')}</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity style={[s.invActBtn, { backgroundColor: withAlpha(c.textMain, 0.06), borderColor: c.secondary }]} onPress={() => showToast('🔄 ' + t('invReapply'))}>
                          <Text style={[s.invActBtnText, { color: c.textSub }]}>{t('invReapply')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ═══ TOAST ═══ */}
      {toast !== '' && (
        <View style={s.toastWrap}>
          <View style={s.toast}>
            <Text style={s.toastText}>{toast}</Text>
          </View>
        </View>
      )}

      {/* ═══ DRAWER ═══ */}
      {drawerOpen && (
        <View style={s.drawerOverlay} onTouchEnd={() => setDrawerOpen(false)}>
          <View style={[s.drawer, { backgroundColor: c.surface }]} onTouchEnd={(e: any) => e.stopPropagation?.()}>
            <View style={[s.drawerHandle, { backgroundColor: c.secondary }]} />
            <View style={[s.drawerHead, { borderBottomColor: c.secondary }]}>
              <Text style={[s.drawerTitle, { color: c.textMain }]}>{t('invApply')}</Text>
              <TouchableOpacity style={[s.drawerClose, { backgroundColor: withAlpha(c.textMain, 0.06), borderColor: c.secondary }]} onPress={() => setDrawerOpen(false)}>
                <IcnClose />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.drawerBody} contentContainerStyle={{ paddingBottom: 32 }}>
              <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerType')}</Text>
              <View style={s.dTypeRow}>
                {(['vat', 'general', 'receipt'] as InvType[]).map(tp => (
                  <TouchableOpacity key={tp} style={[s.dTypeChip, dType === tp && { backgroundColor: withAlpha(c.primary, 0.08), borderColor: c.primary }]} onPress={() => setDType(tp)}>
                    <Text style={[s.dTypeChipText, { color: dType === tp ? c.primary : c.textSub }]}>{tp === 'vat' ? t('invVatSpecial') : tp === 'general' ? t('invGeneral') : t('invReceipt')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerAmount')}<Text style={{ color: c.primary }}>*</Text></Text>
                <View style={{ position: 'relative' }}>
                  <Text style={[s.dAmountPrefix, { color: c.textSub }]}>¥</Text>
                  <TextInput style={[s.dInput, s.dAmountInput, { color: c.textMain, borderColor: c.secondary, backgroundColor: c.surface }]} value={dAmount} onChangeText={setDAmount} placeholder="0.00" placeholderTextColor={c.textSub} keyboardType="decimal-pad" />
                </View>
              </View>

              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerBuyer')}<Text style={{ color: c.primary }}>*</Text><Text style={{ color: c.textSub, fontWeight: '400', fontSize: 11, marginLeft: 'auto' } as any}>{t('invAutoFilled')}</Text></Text>
                <TextInput style={[s.dInput, { color: c.textMain, borderColor: c.secondary, backgroundColor: c.surface }]} value={data.company_name} editable={false} />
              </View>

              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerTaxId')}<Text style={{ color: c.primary }}>*</Text></Text>
                <TextInput style={[s.dInput, { color: c.textMain, borderColor: c.secondary, backgroundColor: c.surface, fontFamily: 'DM Mono' } as any]} value={data.tax_id} editable={false} />
              </View>

              <View style={s.dRow}>
                <View style={s.dField}>
                  <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerDate')}</Text>
                  <TextInput style={[s.dInput, { color: c.textMain, borderColor: c.secondary, backgroundColor: c.surface }]} value={dDate} onChangeText={setDDate} placeholder="YYYY-MM-DD" placeholderTextColor={c.textSub} />
                </View>
                <View style={s.dField}>
                  <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerRef')}</Text>
                  <TextInput style={[s.dInput, { color: c.textMain, borderColor: c.secondary, backgroundColor: c.surface }]} value={dRef} onChangeText={setDRef} placeholder={t('invOptional')} placeholderTextColor={c.textSub} />
                </View>
              </View>

              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invDrawerNote')}</Text>
                <TextInput style={[s.dInput, { color: c.textMain, borderColor: c.secondary, backgroundColor: c.surface }]} value={dNote} onChangeText={setDNote} placeholder={t('invDrawerNotePlaceholder')} placeholderTextColor={c.textSub} />
              </View>

              <View style={s.dField}>
                <Text style={[s.dLabel, { color: c.textSub }]}>{t('invEmail')}</Text>
                <TextInput style={[s.dInput, { color: c.textMain, borderColor: c.secondary, backgroundColor: c.surface }]} value={dEmail} onChangeText={setDEmail} placeholder="email@example.com" placeholderTextColor={c.textSub} keyboardType="email-address" />
              </View>

              <TouchableOpacity style={[s.dSubmit, { backgroundColor: c.primary }]} onPress={() => { setDrawerOpen(false); showToast('✅ ' + t('invSubmitDone')); }}>
                <Text style={s.dSubmitText}>{t('invSubmit')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

/* ═══════════════ EDITABLE INFO ROW ═══════════════ */

function EditableInfoRow({ icon, iconBg, label, value, colors, mono, onChange }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string; colors: ThemeColors; mono?: boolean; onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    if (draft !== value) onChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={[sIR.row, { borderBottomColor: colors.secondary }]}>
        <View style={[sIR.icon, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={sIR.body}>
          <Text style={[sIR.label, { color: colors.textSub }]}>{label}</Text>
          <TextInput
            style={[sIR.valueInput, { color: colors.textMain, fontFamily: mono ? 'DM Mono' : undefined } as any]}
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            autoFocus
            placeholder={value || '—'}
            placeholderTextColor={colors.textSub}
          />
        </View>
        <TouchableOpacity style={sIR.editBtn} onPress={commit}>
          <PencilSvg color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[sIR.row, { borderBottomColor: colors.secondary }]} onPress={() => { setDraft(value); setEditing(true); }} activeOpacity={0.7}>
      <View style={[sIR.icon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={sIR.body}>
        <Text style={[sIR.label, { color: colors.textSub }]}>{label}</Text>
        <Text style={[sIR.value, { color: value ? colors.textMain : colors.textSub, fontWeight: value ? '500' : '400', fontFamily: mono ? 'DM Mono' : undefined } as any]} numberOfLines={1}>{value || t('invEmpty')}</Text>
      </View>
      <PencilSvg color={colors.textSub} />
    </TouchableOpacity>
  );
}

/* ═══════════════ STYLES ═══════════════ */

const s = StyleSheet.create({
  root: { flex: 1 } as any,
  scroll: { flex: 1 } as any,

  /* NAV — frosted glass, matches historyHeader style */
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 10, backgroundColor: 'transparent', backdropFilter: 'saturate(200%) blur(30px)', borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' } as any,
  navBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' } as any,
  navTitle: { fontSize: 16, fontWeight: '600' } as any,
  navRight: { flexDirection: 'row', gap: 8 } as any,

  /* ENTRY CARD — full width, no horizontal margin */
  entryCard: {
    borderRadius: 0, padding: 20, paddingBottom: 18,
    position: 'relative', overflow: 'hidden' as any,
    backgroundColor: '#00FF7F',
    marginBottom: 14,
  } as any,
  ecTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 } as any,
  ecLabel: { fontSize: 11, letterSpacing: 1.3, color: 'rgba(0,0,0,0.5)', marginBottom: 4, textTransform: 'uppercase' } as any,
  ecTitle: { fontSize: 18, fontWeight: '600', color: '#1A1410', letterSpacing: 0.3 } as any,
  ecIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' } as any,
  ecStats: { flexDirection: 'row', marginBottom: 16, gap: 0 } as any,
  ecStat: { flex: 1, paddingHorizontal: 12, borderRightWidth: 1 } as any,
  ecStatNum: { fontSize: 20, fontWeight: '600', color: '#1A1410', fontFamily: 'DM Mono', letterSpacing: -0.2 } as any,
  ecStatLbl: { fontSize: 10, color: 'rgba(0,0,0,0.5)', marginTop: 2 } as any,
  ecBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.08)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16,
  } as any,
  ecBtnText: { fontSize: 13, fontWeight: '500', color: '#1A1410' } as any,

  /* TABS */
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, borderRadius: 10, padding: 3 } as any,
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 } as any,
  tabOn: { shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } } as any,
  tabText: { fontSize: 13, fontWeight: '500' } as any,

  /* TIPS */
  tips: { marginHorizontal: 16, marginBottom: 14, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1 } as any,
  tipsIcon: { fontSize: 15, flexShrink: 0, marginTop: 1 } as any,
  tipsText: { fontSize: 12, lineHeight: 19, flex: 1 } as any,

  /* INFO CARD — full width, no horizontal margin */
  infoCard: { borderRadius: 0, borderWidth: 1, borderLeftWidth: 0, borderRightWidth: 0, overflow: 'hidden', marginBottom: 14 } as any,
  typeToggle: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 } as any,
  typeChip: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1.5 } as any,
  typeChipText: { fontSize: 12, fontWeight: '500' } as any,

  /* FILTER */
  filterRow: { marginBottom: 12 } as any,
  fc: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 } as any,
  fcText: { fontSize: 12 } as any,

  /* INVOICE CARD */
  invCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden', position: 'relative' } as any,
  invTorn: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, opacity: 0.4 } as any,
  invTop: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderStyle: 'dashed',
    flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 4,
  } as any,
  invBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, flexShrink: 0, marginTop: 2 } as any,
  invBadgeText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, whiteSpace: 'nowrap' } as any,
  invMain: { flex: 1, minWidth: 0 } as any,
  invCompany: { fontSize: 14, fontWeight: '600', marginBottom: 3 } as any,
  invTax: { fontSize: 11, fontFamily: 'DM Mono', marginBottom: 4 } as any,
  invMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' } as any,
  invDate: { fontSize: 11 } as any,
  invNo: { fontSize: 10, fontFamily: 'DM Mono' } as any,
  invSealWrap: {
    flexShrink: 0, width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center',
  } as any,
  invBottom: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } as any,
  invAmount: { fontSize: 20, fontWeight: '700', fontFamily: 'DM Mono', letterSpacing: -0.2 } as any,
  invAmountLabel: { fontSize: 10, marginTop: 1 } as any,
  invActions: { flexDirection: 'row', gap: 6 } as any,
  invActBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 } as any,
  invActBtnText: { fontSize: 12, fontWeight: '500' } as any,

  /* EMPTY */
  empty: { alignItems: 'center', paddingVertical: 48 } as any,
  emptyIcon: { fontSize: 48, marginBottom: 12, opacity: 0.4 } as any,
  emptyText: { fontSize: 14, lineHeight: 22 } as any,

  /* TOAST */
  toastWrap: { position: 'fixed', bottom: 90, left: '50%', transform: [{ translateX: '-50%' }], zIndex: 200 } as any,
  toast: { backgroundColor: 'rgba(28,28,26,0.88)', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 } as any,
  toastText: { color: '#fff', fontSize: 13, whiteSpace: 'nowrap' } as any,

  /* DRAWER */
  drawerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' } as any,
  drawer: { width: '100%', maxWidth: 430, borderRadius: 20, maxHeight: '90vh', display: 'flex', flexDirection: 'column' } as any,
  drawerHandle: { width: 36, height: 4, borderRadius: 2, marginTop: 12, alignSelf: 'center', flexShrink: 0 } as any,
  drawerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 12, borderBottomWidth: 1, flexShrink: 0 } as any,
  drawerTitle: { fontSize: 15, fontWeight: '600' } as any,
  drawerClose: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' } as any,
  drawerBody: { flex: 1, paddingHorizontal: 20, paddingTop: 16 } as any,

  dLabel: { fontSize: 12, fontWeight: '500', marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } as any,
  dField: { marginBottom: 14 } as any,
  dInput: { width: '100%', paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1.5, borderRadius: 8, fontSize: 14, outline: 'none' } as any,
  dAmountInput: { paddingLeft: 26 } as any,
  dAmountPrefix: { position: 'absolute', left: 14, top: '50%', fontSize: 14, fontFamily: 'DM Mono' } as any,
  dRow: { flexDirection: 'row', gap: 10 } as any,
  dTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 } as any,
  dTypeChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1.5 } as any,
  dTypeChipText: { fontSize: 13, fontWeight: '500' } as any,
  dSubmit: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 } as any,
  dSubmitText: { fontSize: 15, fontWeight: '600', color: '#fff' } as any,
});

/* ═══════════════ INFO ROW STYLES ═══════════════ */

const sIR = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, gap: 12 } as any,
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 } as any,
  body: { flex: 1, minWidth: 0 } as any,
  label: { fontSize: 11, marginBottom: 2 } as any,
  value: { fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden' } as any,
  valueInput: { fontSize: 13, fontWeight: '500', borderWidth: 0, outline: 'none', background: 'transparent', padding: 0, flex: 1 } as any,
  editBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 } as any,
});

/* ═══════════════ BADGE STYLES ═══════════════ */

const sBadge = StyleSheet.create({
  vat: {} as any,
  general: {} as any,
  receipt: {} as any,
});
