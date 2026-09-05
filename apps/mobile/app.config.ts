import type {ExpoConfig} from 'expo/config';
const config:ExpoConfig={
 name:'Compa Virtual',slug:'compa-virtual',scheme:'compavirtual',version:'0.1.0',
 orientation:'portrait',userInterfaceStyle:'light',
 ios:{supportsTablet:true,bundleIdentifier:process.env.IOS_BUNDLE_IDENTIFIER??'com.compavirtual.estudio',infoPlist:{ITSAppUsesNonExemptEncryption:false}},
 android:{package:process.env.ANDROID_PACKAGE??'com.compavirtual.estudio',permissions:['POST_NOTIFICATIONS']},
 web:{bundler:'metro',output:'static'},
 plugins:['expo-router','expo-secure-store','expo-sqlite',['expo-notifications',{defaultChannel:'study-reminders'}]],
 extra:{eas:{projectId:process.env.EXPO_PUBLIC_EAS_PROJECT_ID??null}},
 experiments:{typedRoutes:true}
};export default config;

