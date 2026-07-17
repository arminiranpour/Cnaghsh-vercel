"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { VideoUploadField } from "@/components/media/VideoUploadField";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type { City } from "@/lib/location/cities";
import { IMAGE_ACCEPT } from "@/lib/media/formats";
import { responsiveImageLoader } from "@/lib/media/responsive-images";

import { upsertPersonalInfo } from "@/lib/profile/profile-actions";

type PersonalInfoFormValues = {
  firstName: string;
  lastName: string;
  stageName: string;
  age: string;
  phone: string;
  address: string;
  cityId: string;
  avatarUrl: string;
  bio: string;
  introVideoMediaId: string;
};

type FieldErrors = Partial<Record<keyof PersonalInfoFormValues, string>>;

type PersonalInfoFormProps = {
  cities: City[];
  initialValues: {
    firstName?: string | null;
    lastName?: string | null;
    stageName?: string | null;
    age?: number | null;
    phone?: string | null;
    address?: string | null;
    cityId?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    introVideoMediaId?: string | null;
  };
};

export function PersonalInfoForm({ cities, initialValues }: PersonalInfoFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<PersonalInfoFormValues>({
    firstName: initialValues.firstName ?? "",
    lastName: initialValues.lastName ?? "",
    stageName: initialValues.stageName ?? "",
    age: initialValues.age ? String(initialValues.age) : "",
    phone: initialValues.phone ?? "",
    address: initialValues.address ?? "",
    cityId: initialValues.cityId ?? "",
    avatarUrl: initialValues.avatarUrl ?? "",
    bio: initialValues.bio ?? "",
    introVideoMediaId: initialValues.introVideoMediaId ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isVideoBusy, setIsVideoBusy] = useState(false);

  const updateValue = (field: keyof PersonalInfoFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      setValues((prev) => ({ ...prev, [field]: nextValue }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      setFormError(null);
    };

  const handleCityChange = (cityId: string) => {
    setValues((prev) => ({ ...prev, cityId }));
    setFieldErrors((prev) => ({ ...prev, cityId: undefined }));
    setFormError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    formData.set("firstName", values.firstName.trim());
    formData.set("lastName", values.lastName.trim());
    formData.set("stageName", values.stageName.trim());
    formData.set("age", values.age.trim());
    formData.set("phone", values.phone.trim());
    formData.set("address", values.address.trim());
    formData.set("cityId", values.cityId.trim());
    formData.set("bio", values.bio.trim());
    formData.set("avatarUrl", values.avatarUrl.trim());
    formData.set("introVideoMediaId", values.introVideoMediaId.trim());

    startTransition(() => {
      upsertPersonalInfo(formData)
        .then((result) => {
          if (result.ok) {
            setFieldErrors({});
            setFormError(null);
            if (result.data?.avatarUrl) {
              setValues((prev) => ({ ...prev, avatarUrl: result.data?.avatarUrl ?? "" }));
            }
            toast({
              title: "اطلاعات پروفایل ذخیره شد.",
              description: "اطلاعات فردی با موفقیت به‌روزرسانی شد.",
            });
            router.refresh();
          } else {
            setFieldErrors(result.fieldErrors ?? {});
            setFormError(result.error ?? null);
          }
        })
        .catch(() => {
          setFormError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
        });
    });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <input type="hidden" name="avatarUrl" value={values.avatarUrl} />
      <input type="hidden" name="introVideoMediaId" value={values.introVideoMediaId} />

      <div className="grid gap-4 md:grid-cols-2" dir="rtl">
        <div className="space-y-2">
          <Label htmlFor="firstName">نام</Label>
          <Input
            id="firstName"
            name="firstName"
            value={values.firstName}
            onChange={updateValue("firstName")}
            maxLength={191}
            required
            disabled={isPending}
            placeholder="نام خود را وارد کنید"
          />
          {fieldErrors.firstName ? (
            <p className="text-sm text-destructive">{fieldErrors.firstName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">نام خانوادگی</Label>
          <Input
            id="lastName"
            name="lastName"
            value={values.lastName}
            onChange={updateValue("lastName")}
            maxLength={191}
            required
            disabled={isPending}
            placeholder="نام خانوادگی خود را وارد کنید"
          />
          {fieldErrors.lastName ? (
            <p className="text-sm text-destructive">{fieldErrors.lastName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="stageName">نام مستعار (اختیاری)</Label>
          <Input
            id="stageName"
            name="stageName"
            value={values.stageName}
            onChange={updateValue("stageName")}
            maxLength={191}
            disabled={isPending}
            placeholder="مثلاً نام هنری"
          />
          {fieldErrors.stageName ? (
            <p className="text-sm text-destructive">{fieldErrors.stageName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="age">سن</Label>
          <Input
            id="age"
            name="age"
            type="number"
            min={5}
            max={120}
            value={values.age}
            onChange={updateValue("age")}
            required
            disabled={isPending}
            placeholder="سن"
          />
          {fieldErrors.age ? (
            <p className="text-sm text-destructive">{fieldErrors.age}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">شماره تلفن</Label>
          <Input
            id="phone"
            name="phone"
            value={values.phone}
            onChange={updateValue("phone")}
            inputMode="numeric"
            dir="ltr"
            required
            disabled={isPending}
            placeholder="0XXXXXXXXXX"
          />
          <CardDescription className="text-xs text-muted-foreground">
            این شماره به صورت عمومی نمایش داده نمی‌شود.
          </CardDescription>
          {fieldErrors.phone ? (
            <p className="text-sm text-destructive">{fieldErrors.phone}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">آدرس (غیرقابل نمایش عمومی)</Label>
          <Input
            id="address"
            name="address"
            value={values.address}
            onChange={updateValue("address")}
            maxLength={1000}
            disabled={isPending}
            placeholder="نشانی محل سکونت یا کار"
          />
          {fieldErrors.address ? (
            <p className="text-sm text-destructive">{fieldErrors.address}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cityId">شهر</Label>
          <Select
            value={values.cityId}
            onValueChange={handleCityChange}
            disabled={isPending || cities.length === 0}
            name="cityId"
          >
            <SelectTrigger>
              <SelectValue placeholder="شهر خود را انتخاب کنید" />
            </SelectTrigger>
            <SelectContent>
              {cities.length === 0 ? (
                <SelectItem disabled value="no_cities">
                  به‌زودی لیست شهرها تکمیل می‌شود
                </SelectItem>
              ) : null}
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="cityId" value={values.cityId} />
          {fieldErrors.cityId ? (
            <p className="text-sm text-destructive">{fieldErrors.cityId}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="avatar">تصویر پروفایل</Label>
        {values.avatarUrl ? (
          <div className="flex flex-col items-start gap-2">
            <div className="overflow-hidden rounded-md border">
              <Image
                src={values.avatarUrl}
                loader={responsiveImageLoader}
                alt="پیش‌نمایش تصویر پروفایل"
                width={160}
                height={160}
                className="h-40 w-40 object-cover"
                sizes="160px"
              />
            </div>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {values.avatarUrl}
            </p>
          </div>
        ) : null}
        <Input
          id="avatar"
          name="avatar"
          type="file"
          accept={IMAGE_ACCEPT}
          disabled={isPending}
          dir="ltr"
        />
        {fieldErrors.avatarUrl ? (
          <p className="text-sm text-destructive">{fieldErrors.avatarUrl}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <VideoUploadField
          label="ویدیوی معرفی"
          description="ویدیوی کوتاهی از خود بارگذاری کنید. فرمت‌های mp4، webm یا mov پذیرفته می‌شوند."
          value={values.introVideoMediaId ? values.introVideoMediaId : null}
          onValueChange={(mediaId) => {
            setValues((prev) => ({ ...prev, introVideoMediaId: mediaId ?? "" }));
            setFieldErrors((prev) => ({ ...prev, introVideoMediaId: undefined }));
          }}
          onBusyChange={setIsVideoBusy}
          disabled={isPending}
        />
        {fieldErrors.introVideoMediaId ? (
          <p className="text-sm text-destructive">{fieldErrors.introVideoMediaId}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">بیوگرافی (اختیاری)</Label>
        <Textarea
          id="bio"
          name="bio"
          value={values.bio}
          onChange={updateValue("bio")}
          maxLength={2000}
          rows={5}
          disabled={isPending}
          placeholder="درباره خود بنویسید"
        />
        {fieldErrors.bio ? (
          <p className="text-sm text-destructive">{fieldErrors.bio}</p>
        ) : null}
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={isPending || isVideoBusy}>
          {isPending ? "در حال ذخیره..." : "ذخیره اطلاعات"}
        </Button>
      </div>
    </form>
  );
}
