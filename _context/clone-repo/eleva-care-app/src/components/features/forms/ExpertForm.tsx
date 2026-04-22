'use client';

import type * as z from 'zod';
import RichTextEditor from '@/components/shared/rich-text/RichTextEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SOCIAL_MEDIA_LIST } from '@/lib/constants/social-media';
import { cn } from '@/lib/utils';
import { profileFormSchema } from '@/schema/profile';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Info } from 'lucide-react';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

type ExpertFormValues = z.infer<typeof profileFormSchema> & {
  username?: string;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

interface ExpertFormProps {
  initialData: ExpertFormValues | null;
}

export function ExpertForm({ initialData }: ExpertFormProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const form = useForm<ExpertFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: initialData?.firstName || user?.firstName || '',
      lastName: initialData?.lastName || user?.lastName || '',
      profilePicture:
        initialData?.profilePicture ||
        (user as any)?.profilePictureUrl ||
        (user as any)?.profile_picture_url ||
        '',
      headline: initialData?.headline || '',
      shortBio: initialData?.shortBio || '',
      longBio: initialData?.longBio || '',
      primaryCategoryId: initialData?.primaryCategoryId || '',
      secondaryCategoryId: initialData?.secondaryCategoryId || 'none',
      socialLinks: SOCIAL_MEDIA_LIST.map((platform) => ({
        name: platform.name,
        url:
          initialData?.socialLinks
            ?.find((link) => link.name === platform.name)
            ?.url?.replace(platform.baseUrl, '') || '',
      })),
    },
  });

  React.useEffect(() => {
    if (user) {
      // Set values if there's no initialData or if the fields are empty
      if (!initialData?.firstName || form.getValues('firstName') === '') {
        form.setValue('firstName', user.firstName || '');
      }
      if (!initialData?.lastName || form.getValues('lastName') === '') {
        form.setValue('lastName', user.lastName || '');
      }
    }
  }, [user, form, initialData]);

  // Helper function to safely clean up blob URLs
  const cleanupBlobUrl = React.useCallback((url: string) => {
    try {
      if (url?.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.warn('Failed to revoke blob URL:', error);
    }
  }, []);

  // Fetch categories on component mount
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Failed to load categories');
      }
    }
    fetchCategories();
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear the input value so the same file can be selected again
    e.target.value = '';

    console.log('File size:', file.size / (1024 * 1024), 'MB');

    if (file.size > 4.5 * 1024 * 1024) {
      console.log('File too large, showing error');
      toast.error('Image must be less than 4.5MB', {
        description: 'Please choose a smaller image file.',
      });
      return;
    }

    setIsUploading(true);
    try {
      // Clean up any existing blob URL before creating a new one
      const currentProfilePicture = form.getValues('profilePicture');
      if (currentProfilePicture) {
        cleanupBlobUrl(currentProfilePicture);
      }

      setSelectedFile(file);
      const previewUrl = URL.createObjectURL(file);
      form.setValue('profilePicture', previewUrl);
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image', {
        description: 'Please try again with a different image.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  async function onSubmit(data: ExpertFormValues) {
    try {
      setIsLoading(true);

      // Note: Username is updated via the profile API endpoint along with other profile data
      // WorkOS doesn't have a user.update() method like Clerk did

      // Transform usernames to full URLs
      const transformedData = {
        ...data,
        // Convert 'none' to null for secondaryCategoryId
        secondaryCategoryId: data.secondaryCategoryId === 'none' ? null : data.secondaryCategoryId,
        socialLinks: data.socialLinks.map((link) => {
          const platform = SOCIAL_MEDIA_LIST.find((p) => p.name === link.name);
          if (!platform) return link;

          const username = link.url?.trim();
          if (!username) return { name: link.name, url: '' };

          return {
            name: link.name,
            url: `${platform.baseUrl}${username.replace(/^@/, '')}`,
          };
        }),
      };

      let profilePictureUrl = transformedData.profilePicture;
      if (selectedFile) {
        setIsUploading(true);
        // Create a Safari-friendly filename without special characters
        const timestamp = Date.now();
        // Remove any problematic characters that might cause Safari issues
        const sanitizedName = selectedFile.name
          .replace(/[^a-zA-Z0-9.-]/g, '-') // Replace special chars with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

        const filename = `${user?.id}-${timestamp}-${sanitizedName}`;
        const response = await fetch(
          `/api/upload?filename=${encodeURIComponent(filename)}&folder=profiles`,
          {
            method: 'POST',
            body: selectedFile,
          },
        );

        if (!response.ok) {
          throw new Error('Failed to upload image');
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to upload image');
        }

        profilePictureUrl = data.url;
        setIsUploading(false);

        // Delete old profile picture if it exists in blob storage
        if (initialData?.profilePicture?.includes('public.blob.vercel-storage.com')) {
          try {
            await fetch(`/api/upload?url=${encodeURIComponent(initialData.profilePicture)}`, {
              method: 'DELETE',
            });
          } catch (error) {
            console.error('Failed to delete old profile picture:', error);
          }
        }
      }

      // Ensure we never save a temporary blob URL to the database
      if (profilePictureUrl?.startsWith('blob:')) {
        throw new Error('Cannot save temporary blob URL. Please try uploading the image again.');
      }

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...transformedData,
          profilePicture: profilePictureUrl,
        }),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || 'Failed to update profile');
      }

      toast.success('Profile updated successfully');

      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    return () => {
      // Cleanup blob URLs when component unmounts
      const profilePicture = form.getValues('profilePicture');
      if (profilePicture) {
        cleanupBlobUrl(profilePicture);
      }
    };
  }, [form, cleanupBlobUrl]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-2 text-lg font-medium">Basic Information</legend>

          <FormField
            control={form.control}
            name="profilePicture"
            render={({ field }) => (
              <FormItem className="col-span-full">
                <FormLabel>Profile Picture</FormLabel>
                <div className="space-y-4">
                  <div className="flex items-center gap-8">
                    {field.value && (
                      <div className="border-border relative h-96 w-64 overflow-hidden rounded-lg border-2">
                        <Image
                          src={field.value}
                          alt="Profile picture"
                          fill
                          className="object-cover"
                          priority
                          onError={(_e) => {
                            console.warn('Image failed to load:', field.value);
                            // If blob URL fails, try to clean it up and reset
                            if (field.value?.startsWith('blob:')) {
                              cleanupBlobUrl(field.value);
                              // Fallback to WorkOS profile picture if available
                              const workosImageUrl =
                                (user as any)?.profilePictureUrl ||
                                (user as any)?.profile_picture_url ||
                                '';
                              form.setValue('profilePicture', workosImageUrl);
                              setSelectedFile(null);
                            }
                          }}
                        />
                      </div>
                    )}
                    <FormControl>
                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor="picture-upload"
                          className={cn(
                            'border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex h-9 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
                            isUploading && 'pointer-events-none opacity-50',
                          )}
                        >
                          {field.value ? 'Change picture' : 'Upload picture'}
                        </label>
                        <Input
                          id="picture-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          disabled={isUploading}
                        />
                        {field.value && (
                          <button
                            type="button"
                            onClick={() => {
                              // Clean up blob URL if removing
                              const currentProfilePicture = form.getValues('profilePicture');
                              if (currentProfilePicture) {
                                cleanupBlobUrl(currentProfilePicture);
                              }

                              // WorkOS doesn't have imageUrl - just clear the field
                              form.setValue('profilePicture', '');
                              setSelectedFile(null);
                            }}
                            className={cn(
                              'border-destructive bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-ring flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
                              isUploading && 'pointer-events-none opacity-50',
                            )}
                            disabled={isUploading}
                          >
                            Reset to Account Picture
                          </button>
                        )}
                        {isUploading && (
                          <span className="text-muted-foreground flex items-center gap-2 text-sm">
                            <span className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                            Uploading...
                          </span>
                        )}
                      </div>
                    </FormControl>
                  </div>
                  <FormDescription>
                    Upload a profile picture (max 4.5MB). A portrait (2:3) image is recommended.
                  </FormDescription>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="username" {...field} />
                </FormControl>
                <FormDescription>Choose a unique username for your profile</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Badge
                variant={initialData?.isVerified ? 'default' : 'secondary'}
                className="cursor-default"
              >
                {initialData?.isVerified ? 'Verified' : 'Unverified'}
              </Badge>
              <Popover>
                <PopoverTrigger>
                  <Info className="text-muted-foreground hover:text-foreground h-4 w-4 transition-colors" />
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="font-medium">Verified Expert Status</h4>
                    <p className="text-muted-foreground text-sm">
                      Verified experts have had their credentials and expertise validated by our
                      team. This badge helps users identify trusted professionals on our platform.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={initialData?.isTopExpert ? 'default' : 'secondary'}
                className="cursor-default"
              >
                {initialData?.isTopExpert ? 'Top Expert' : 'Community Expert'}
              </Badge>
              <Popover>
                <PopoverTrigger>
                  <Info className="text-muted-foreground hover:text-foreground h-4 w-4 transition-colors" />
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="font-medium">Top Expert Status</h4>
                    <p className="text-muted-foreground text-sm">
                      Top Experts are recognized leaders in their field with exceptional
                      contributions and engagement on our platform. This status is awarded to our
                      most distinguished members.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-2 text-lg font-medium">Professional Profile</legend>

          <FormField
            control={form.control}
            name="headline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Headline</FormLabel>
                <FormControl>
                  <Input placeholder="Women's Health Expert & Researcher" {...field} />
                </FormControl>
                <FormDescription>
                  In one line, describe who you are, what you are best know for, or expertise.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shortBio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brief Introduction</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Brief introduction (100 characters)"
                    maxLength={100}
                    {...field}
                  />
                </FormControl>
                <FormDescription className="flex justify-between">
                  <span>This will be displayed in cards and previews</span>
                  <span>{field.value?.length || 0}/100</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="longBio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About Me</FormLabel>
                <FormControl>
                  <RichTextEditor
                    variant="full"
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Tell potential clients about yourself, your expertise, and what makes you unique..."
                    features={{
                      images: true,
                      tables: true,
                      colors: true,
                      alignment: true,
                      typography: true,
                      links: true,
                    }}
                  />
                </FormControl>
                <FormDescription>
                  You can use Markdown formatting to style your text. Add links, lists, and basic
                  formatting.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-2 text-lg font-medium">Categories & Expertise</legend>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="primaryCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Category</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your primary category" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Main Categories */}
                        {categories
                          .filter((cat) => !cat.parentId)
                          .map((category) => (
                            <React.Fragment key={category.id}>
                              <SelectItem value={category.id}>{category.name}</SelectItem>
                              {/* Subcategories */}
                              {categories
                                .filter((subcat) => subcat.parentId === category.id)
                                .map((subcategory) => (
                                  <SelectItem
                                    key={subcategory.id}
                                    value={subcategory.id}
                                    className="pl-6 text-sm"
                                  >
                                    {subcategory.name}
                                  </SelectItem>
                                ))}
                            </React.Fragment>
                          ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Choose the main category or subcategory that best describes your expertise
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secondaryCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Category</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!form.getValues('primaryCategoryId')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your secondary category (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {/* Main Categories */}
                        {categories
                          .filter((cat) => !cat.parentId)
                          .map((category) => (
                            <React.Fragment key={category.id}>
                              {/* Display primary category as disabled instead of hiding it */}
                              <SelectItem
                                value={category.id}
                                disabled={category.id === form.getValues('primaryCategoryId')}
                              >
                                {category.name}
                                {category.id === form.getValues('primaryCategoryId') &&
                                  ' (Primary)'}
                              </SelectItem>
                              {/* Subcategories */}
                              {categories
                                .filter((subcat) => subcat.parentId === category.id)
                                .map((subcategory) => (
                                  <SelectItem
                                    key={subcategory.id}
                                    value={subcategory.id}
                                    className="pl-6 text-sm"
                                    disabled={
                                      subcategory.id === form.getValues('primaryCategoryId')
                                    }
                                  >
                                    {subcategory.name}
                                    {subcategory.id === form.getValues('primaryCategoryId') &&
                                      ' (Primary)'}
                                  </SelectItem>
                                ))}
                            </React.Fragment>
                          ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    {!form.getValues('primaryCategoryId')
                      ? 'Please select a primary category first'
                      : 'Optionally choose another category or subcategory to highlight additional expertise'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-2 text-lg font-medium">Social Media Links</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_MEDIA_LIST.map((platform, index) => (
              <FormField
                key={platform.name}
                control={form.control}
                name={`socialLinks.${index}.url` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {platform.name.charAt(0).toUpperCase() + platform.name.slice(1)}
                    </FormLabel>
                    <div className="flex w-full items-center overflow-hidden rounded-md border">
                      <div className="bg-muted text-muted-foreground flex h-full items-center px-3 py-2 text-sm">
                        {platform.baseUrl.replace(/^https?:\/\//, '')}
                      </div>
                      <div className="bg-border w-px self-stretch" />
                      <FormControl>
                        <Input
                          placeholder="username"
                          {...field}
                          className="bg-background flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </FormControl>
                    </div>
                    <FormDescription>Username without @ symbol</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </fieldset>

        <Button type="submit" disabled={isLoading || isUploading}>
          {isLoading || isUploading ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </Form>
  );
}
