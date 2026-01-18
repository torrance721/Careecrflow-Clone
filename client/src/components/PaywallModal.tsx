import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { usePaywallTracking } from '@/hooks/useAnalytics';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaywallModal({ isOpen, onClose, triggerLocation = 'unknown', triggerReason = 'manual', featureName = 'unknown' }: PaywallModalProps & { triggerLocation?: string; triggerReason?: string; featureName?: string }) {
  const { trackPaywallShown, trackPaywallClick } = usePaywallTracking();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const isZh = false; // 默认英文

  // Track paywall shown
  useEffect(() => {
    if (isOpen) {
      trackPaywallShown(triggerLocation, triggerReason, featureName);
    }
  }, [isOpen, triggerLocation, triggerReason, featureName, trackPaywallShown]);

  if (!isOpen) return null;

  const plans = [
    {
      id: 'weekly',
      name: '周度订阅',
      nameEn: 'Weekly',
      price: '$9.9',
      period: '/周',
      periodEn: '/week',
      features: [
        '无限职位搜索',
        '精准推荐公司',
        '面试模拟练习',
        '7天有效期'
      ],
      featuresEn: [
        'Unlimited job search',
        'Precise company recommendations',
        'Mock interview practice',
        '7 days validity'
      ]
    },
    {
      id: 'monthly',
      name: '月度订阅',
      nameEn: 'Monthly',
      price: '$19.9',
      period: '/月',
      periodEn: '/month',
      popular: true,
      features: [
        '无限职位搜索',
        '精准推荐公司',
        '面试模拟练习',
        '30天有效期',
        '优先客服支持'
      ],
      featuresEn: [
        'Unlimited job search',
        'Precise company recommendations',
        'Mock interview practice',
        '30 days validity',
        'Priority support'
      ]
    },
    {
      id: 'yearly',
      name: '年度订阅',
      nameEn: 'Yearly',
      price: '$79.9',
      period: '/年',
      periodEn: '/year',
      discount: '节省 67%',
      discountEn: 'Save 67%',
      features: [
        '无限职位搜索',
        '精准推荐公司',
        '面试模拟练习',
        '365天有效期',
        '优先客服支持',
        '独家职业咨询'
      ],
      featuresEn: [
        'Unlimited job search',
        'Precise company recommendations',
        'Mock interview practice',
        '365 days validity',
        'Priority support',
        'Exclusive career consultation'
      ]
    }
  ];

  const handleSubscribe = () => {
    console.log('User clicked subscribe:', selectedPlan);
    
    // Track paywall click
    const plan = plans.find(p => p.id === selectedPlan);
    trackPaywallClick(
      'upgrade',
      plan?.nameEn || selectedPlan,
      parseFloat(plan?.price.replace('$', '') || '0'),
      triggerLocation
    );
    
    // MVP: 点击后关闭弹窗，不做实际支付
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-card border border-border rounded-lg shadow-lg">
        {/* 关闭按钮 */}
        <button
          onClick={() => {
            trackPaywallClick('close', undefined, undefined, triggerLocation);
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 内容 */}
        <div className="p-8">
          {/* 标题 */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">
              {isZh ? '解锁全部功能' : 'Unlock All Features'}
            </h2>
            <p className="text-muted-foreground">
              {isZh ? '选择最适合您的订阅计划' : 'Choose the plan that works best for you'}
            </p>
          </div>

          {/* 订阅计划 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative p-6 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedPlan === plan.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {/* 最受欢迎标签 */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    {isZh ? '最受欢迎' : 'Most Popular'}
                  </div>
                )}

                {/* 折扣标签 */}
                {plan.discount && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    {isZh ? plan.discount : plan.discountEn}
                  </div>
                )}

                {/* 选中指示器 */}
                <div className="absolute top-4 right-4">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === plan.id
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    }`}
                  >
                    {selectedPlan === plan.id && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                </div>

                {/* 计划名称 */}
                <h3 className="text-xl font-bold mb-2">
                  {isZh ? plan.name : plan.nameEn}
                </h3>

                {/* 价格 */}
                <div className="mb-4">
                  <span className="text-3xl font-bold text-primary">{plan.price}</span>
                  <span className="text-muted-foreground">
                    {isZh ? plan.period : plan.periodEn}
                  </span>
                </div>

                {/* 功能列表 */}
                <ul className="space-y-2">
                  {(isZh ? plan.features : plan.featuresEn).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 订阅按钮 */}
          <div className="text-center">
            <button
              onClick={handleSubscribe}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              {isZh ? '立即订阅' : 'Subscribe Now'}
            </button>
            <p className="text-xs text-muted-foreground mt-4">
              {isZh
                ? '订阅后可随时取消，无需担心自动续费'
                : 'Cancel anytime, no auto-renewal worries'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
