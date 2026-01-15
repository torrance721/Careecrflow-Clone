import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Check, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

interface JobPreferencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const EMPLOYMENT_TYPES_EN = ["Full-time", "Internship", "Part-time", "Contract"];
const EMPLOYMENT_TYPES_ZH: Record<string, string> = {
  "Full-time": "全职",
  "Internship": "实习",
  "Part-time": "兼职",
  "Contract": "合同工",
};

const WORK_MODES_EN = ["Onsite", "Remote", "Hybrid"];
const WORK_MODES_ZH: Record<string, string> = {
  "Onsite": "现场办公",
  "Remote": "远程办公",
  "Hybrid": "混合办公",
};

const POPULAR_CITIES = [
  "New York City, New York",
  "San Francisco, California",
  "Los Angeles, California",
  "Seattle, Washington",
  "Austin, Texas",
  "Boston, Massachusetts",
  "Chicago, Illinois",
  "Denver, Colorado",
];

export function JobPreferencesModal({ open, onOpenChange, onSave }: JobPreferencesModalProps) {
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>([]);
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>("");
  const [location, setLocation] = useState("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const { t, language } = useLanguage();

  const { data: preferences } = trpc.preferences.get.useQuery(undefined, {
    enabled: open,
  });

  const saveMutation = trpc.preferences.save.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      onSave?.();
    },
  });

  useEffect(() => {
    if (preferences) {
      setSelectedEmploymentTypes(preferences.employmentTypes || []);
      setSelectedWorkMode(preferences.workMode || "");
      setLocation(preferences.location || "");
    }
  }, [preferences]);

  const toggleEmploymentType = (type: string) => {
    setSelectedEmploymentTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSave = () => {
    saveMutation.mutate({
      employmentTypes: selectedEmploymentTypes,
      workMode: selectedWorkMode,
      location,
    });
  };

  const filteredCities = POPULAR_CITIES.filter(city =>
    city.toLowerCase().includes(location.toLowerCase())
  );

  const getEmploymentTypeLabel = (type: string) => {
    return language === 'zh' ? EMPLOYMENT_TYPES_ZH[type] || type : type;
  };

  const getWorkModeLabel = (mode: string) => {
    return language === 'zh' ? WORK_MODES_ZH[mode] || mode : mode;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 rounded-3xl overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">{t('preferences.title')}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4 text-primary" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* Employment Type */}
          <div className="space-y-3">
            <Label className="text-base text-muted-foreground">{t('preferences.employmentType')}</Label>
            <div className="flex flex-wrap gap-2">
              {EMPLOYMENT_TYPES_EN.map(type => (
                <Button
                  key={type}
                  variant={selectedEmploymentTypes.includes(type) ? "default" : "secondary"}
                  className={`rounded-full px-4 py-2 h-auto transition-all ${
                    selectedEmploymentTypes.includes(type)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => toggleEmploymentType(type)}
                >
                  {getEmploymentTypeLabel(type)}
                </Button>
              ))}
            </div>
          </div>

          {/* Work Mode */}
          <div className="space-y-3">
            <Label className="text-base text-muted-foreground">{t('preferences.workMode')}</Label>
            <div className="flex flex-wrap gap-2">
              {WORK_MODES_EN.map(mode => (
                <Button
                  key={mode}
                  variant={selectedWorkMode === mode ? "default" : "secondary"}
                  className={`rounded-full px-4 py-2 h-auto transition-all ${
                    selectedWorkMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setSelectedWorkMode(mode)}
                >
                  {getWorkModeLabel(mode)}
                </Button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <Label className="text-base text-muted-foreground">{t('preferences.location')}</Label>
            <div className="relative">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('preferences.locationPlaceholder')}
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setShowCitySuggestions(true);
                  }}
                  onFocus={() => setShowCitySuggestions(true)}
                  className="pl-10 rounded-xl border-border bg-background"
                />
                {location && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setLocation("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {showCitySuggestions && filteredCities.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg max-h-48 overflow-auto">
                  {filteredCities.map(city => (
                    <button
                      key={city}
                      className="w-full px-4 py-2.5 text-left hover:bg-accent transition-colors first:rounded-t-xl last:rounded-b-xl flex items-center gap-2"
                      onClick={() => {
                        setLocation(city);
                        setShowCitySuggestions(false);
                      }}
                    >
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{city}</span>
                      {location === city && (
                        <Check className="h-4 w-4 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1 rounded-full h-12 text-base"
              onClick={() => onOpenChange(false)}
            >
              {t('preferences.cancel')}
            </Button>
            <Button
              className="flex-1 rounded-full h-12 text-base bg-primary hover:bg-primary/90"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending 
                ? (language === 'zh' ? '保存中...' : 'Saving...') 
                : t('preferences.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
