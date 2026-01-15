import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// English translations
const en: Record<string, string> = {
  // Navigation
  'nav.mockInterview': 'Mock Interview',
  'nav.mockQuestions': 'Mock Questions',
  'nav.aiInterview': 'AI Interview',
  
  // Home page
  'home.jobRecommendations': 'Job Recommendations',
  'home.jobsMatched': '{count} jobs matched for you.',
  'home.estimatedMatchAccuracy': 'Estimated Match Accuracy',
  'home.setPreferences': 'Set preferences',
  'home.matchRoles': 'Match Roles',
  'home.noInterviewHistory': 'No interview history yet. Start a mock interview to practice!',
  'home.startMock': 'Start Mock',
  'home.answers': 'Answers',
  'home.recentInterviews': 'Recent Interviews',
  'home.viewAll': 'View All',
  'home.score': 'Score',
  'home.viewReport': 'View Report',
  
  // Job Preferences
  'preferences.title': 'Job Preferences',
  'preferences.employmentType': 'Employment Type',
  'preferences.fullTime': 'Full-time',
  'preferences.partTime': 'Part-time',
  'preferences.internship': 'Internship',
  'preferences.contract': 'Contract',
  'preferences.workMode': 'Work Mode',
  'preferences.onsite': 'On-site',
  'preferences.remote': 'Remote',
  'preferences.hybrid': 'Hybrid',
  'preferences.location': 'Preferred Location',
  'preferences.locationPlaceholder': 'Enter city name...',
  'preferences.save': 'Save Preferences',
  'preferences.cancel': 'Cancel',
  
  // Match Roles
  'matchRoles.title': 'Matched Roles',
  'matchRoles.match': 'Match',
  'matchRoles.viewOnLinkedIn': 'View on LinkedIn',
  'matchRoles.startInterview': 'Start Interview',
  'matchRoles.noJobs': 'No matched jobs found. Try adjusting your preferences.',
  'matchRoles.salary': 'Salary',
  'matchRoles.type': 'Type',
  'matchRoles.industry': 'Industry',
  
  // Mock Interview
  'interview.title': 'Mock Interview',
  'interview.with': 'Interview for',
  'interview.typeMessage': 'Type your response...',
  'interview.send': 'Send',
  'interview.endInterview': 'End Interview',
  'interview.generating': 'AI is thinking...',
  'interview.welcome': 'Welcome to your mock interview! I\'ll ask you questions based on the job requirements. Feel free to share your experiences in detail.',
  'interview.confirmEnd': 'Are you sure you want to end this interview? An assessment report will be generated.',
  'interview.yes': 'Yes, End Interview',
  'interview.no': 'Continue Interview',
  
  // Assessment Report
  'report.title': 'Assessment Report',
  'report.overallMatch': 'Overall Match',
  'report.strengths': 'Your Strengths',
  'report.improvements': 'Areas for Improvement',
  'report.learningPath': 'Recommended Learning Path',
  'report.skillAnalysis': 'Skill Analysis',
  'report.demonstrated': 'Demonstrated',
  'report.required': 'Required',
  'report.gap': 'Gap',
  'report.backToHome': 'Back to Home',
  'report.tryAgain': 'Practice Again',
  'report.generatingReport': 'Generating your assessment report...',
  
  // Mock History
  'history.title': 'Interview History',
  'history.noHistory': 'No interview history yet.',
  'history.date': 'Date',
  'history.position': 'Position',
  'history.company': 'Company',
  'history.matchScore': 'Match Score',
  'history.status': 'Status',
  'history.completed': 'Completed',
  'history.inProgress': 'In Progress',
  
  // Common
  'common.loading': 'Loading...',
  'common.error': 'An error occurred',
  'common.retry': 'Retry',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.previous': 'Previous',
  'common.close': 'Close',
  'common.confirm': 'Confirm',
  'common.language': 'Language',
  'common.english': 'English',
  'common.chinese': '中文',
  
  // Auth
  'auth.login': 'Login',
  'auth.logout': 'Logout',
  'auth.loginRequired': 'Please login to continue',
};

// Chinese translations
const zh: Record<string, string> = {
  // Navigation
  'nav.mockInterview': '模拟面试',
  'nav.mockQuestions': '面试题库',
  'nav.aiInterview': 'AI 面试',
  
  // Home page
  'home.jobRecommendations': '职位推荐',
  'home.jobsMatched': '为您匹配了 {count} 个职位',
  'home.estimatedMatchAccuracy': '预估匹配准确度',
  'home.setPreferences': '设置偏好',
  'home.matchRoles': '查看匹配职位',
  'home.noInterviewHistory': '暂无面试记录，开始模拟面试来练习吧！',
  'home.startMock': '开始模拟',
  'home.answers': '回答数',
  'home.recentInterviews': '最近面试',
  'home.viewAll': '查看全部',
  'home.score': '得分',
  'home.viewReport': '查看报告',
  
  // Job Preferences
  'preferences.title': '求职偏好',
  'preferences.employmentType': '工作类型',
  'preferences.fullTime': '全职',
  'preferences.partTime': '兼职',
  'preferences.internship': '实习',
  'preferences.contract': '合同工',
  'preferences.workMode': '工作模式',
  'preferences.onsite': '现场办公',
  'preferences.remote': '远程办公',
  'preferences.hybrid': '混合办公',
  'preferences.location': '期望工作地点',
  'preferences.locationPlaceholder': '输入城市名称...',
  'preferences.save': '保存偏好',
  'preferences.cancel': '取消',
  
  // Match Roles
  'matchRoles.title': '匹配职位',
  'matchRoles.match': '匹配度',
  'matchRoles.viewOnLinkedIn': '在 LinkedIn 查看',
  'matchRoles.startInterview': '开始面试',
  'matchRoles.noJobs': '未找到匹配的职位，请尝试调整您的偏好设置。',
  'matchRoles.salary': '薪资',
  'matchRoles.type': '类型',
  'matchRoles.industry': '行业',
  
  // Mock Interview
  'interview.title': '模拟面试',
  'interview.with': '面试职位',
  'interview.typeMessage': '输入您的回答...',
  'interview.send': '发送',
  'interview.endInterview': '结束面试',
  'interview.generating': 'AI 正在思考...',
  'interview.welcome': '欢迎参加模拟面试！我会根据职位要求向您提问。请随时详细分享您的经历。',
  'interview.confirmEnd': '确定要结束这次面试吗？系统将生成评估报告。',
  'interview.yes': '是的，结束面试',
  'interview.no': '继续面试',
  
  // Assessment Report
  'report.title': '评估报告',
  'report.overallMatch': '综合匹配度',
  'report.strengths': '您的优势',
  'report.improvements': '待提升领域',
  'report.learningPath': '推荐学习路径',
  'report.skillAnalysis': '技能分析',
  'report.demonstrated': '已展示',
  'report.required': '职位要求',
  'report.gap': '差距',
  'report.backToHome': '返回首页',
  'report.tryAgain': '再次练习',
  'report.generatingReport': '正在生成评估报告...',
  
  // Mock History
  'history.title': '面试历史',
  'history.noHistory': '暂无面试记录',
  'history.date': '日期',
  'history.position': '职位',
  'history.company': '公司',
  'history.matchScore': '匹配分数',
  'history.status': '状态',
  'history.completed': '已完成',
  'history.inProgress': '进行中',
  
  // Common
  'common.loading': '加载中...',
  'common.error': '发生错误',
  'common.retry': '重试',
  'common.back': '返回',
  'common.next': '下一个',
  'common.previous': '上一个',
  'common.close': '关闭',
  'common.confirm': '确认',
  'common.language': '语言',
  'common.english': 'English',
  'common.chinese': '中文',
  
  // Auth
  'auth.login': '登录',
  'auth.logout': '退出登录',
  'auth.loginRequired': '请登录后继续',
};

const translations: Record<Language, Record<string, string>> = { en, zh };

const LANGUAGE_STORAGE_KEY = 'uhired-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to get from localStorage first
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') {
        return saved;
      }
      // Default to English (removed browser language detection)
      // const browserLang = navigator.language.toLowerCase();
      // if (browserLang.startsWith('zh')) {
      //   return 'zh';
      // }
    }
    return 'en'; // Always default to English
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  useEffect(() => {
    // Update html lang attribute
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Helper function to interpolate variables in translations
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/{(\w+)}/g, (_, key) => String(values[key] ?? `{${key}}`));
}
