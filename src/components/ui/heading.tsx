interface HeadingProps {
  title: string;
  description?: string;
  eyebrow?: string;
}

export function Heading({ title, description, eyebrow }: HeadingProps) {
  return (
    <div className='min-w-0'>
      {eyebrow && (
        <p className='text-gold-ink mb-1 text-xs font-medium tracking-[0.2em] uppercase'>
          {eyebrow}
        </p>
      )}
      <h1 className='font-display text-3xl font-medium tracking-tight text-balance md:text-4xl'>
        {title}
      </h1>
      {description && (
        <p className='text-muted-foreground mt-1.5 text-sm text-pretty'>{description}</p>
      )}
    </div>
  );
}
