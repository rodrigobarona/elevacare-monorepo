# Collapsible References Section - Visual Guide

## ✨ New Feature: Collapsible References

The references section is now **collapsible** and beautifully styled with Eleva brand colors!

---

## 📋 Default State (Open on Page Load)

```
┌────────────────────────────────────────────────────────┐
│  📚 References                                    [▼]  │
│  12 supporting studies • Click to expand               │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ (1) Virtual prenatal care and perinatal...     │  │
│  │     Fernandez MA, et al. (2018)                │  │
│  │     [🔗 doi.org/10.1097/AOG...]                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ (2) Comparative effectiveness of group...      │  │
│  │     Cunningham SD, et al. (2019)               │  │
│  │     [🔗 doi.org/10.1097/AOG...]                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ... (10 more)                                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 📚 How to cite:                                 │  │
│  │ All studies are peer-reviewed and published... │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Background**: Gradient from Pale Lavender → White → Sage Green  
**Border**: Light Grey  
**Shadow**: Subtle soft shadow

---

## 🔽 Collapsed State (After User Clicks)

```
┌────────────────────────────────────────────────────────┐
│  📚 References                                    [▶]  │
│  12 supporting studies • Click to expand               │
└────────────────────────────────────────────────────────┘
```

**Behavior**: 
- User can collapse to clean up page
- Still visible at bottom so users know references exist
- Click to expand again

---

## 🎨 Color Breakdown

### Container
```tsx
// Gradient background (Eleva brand)
bg-linear-to-br 
  from-eleva-accent/30        // Pale Lavender (top-left)
  via-white                   // White (middle)
  to-eleva-primary-light/10   // Sage Green (bottom-right)

// Border
border-eleva-neutral-200      // Light Grey

// Shadow
shadow-xs                     // Subtle
```

**Result**: Soft, elegant gradient that feels premium ✨

---

### Header Icon

```
┌─────────┐
│  📚 icon │  ← Deep Teal background (10% opacity)
└─────────┘    Deep Teal icon color
```

```tsx
// Icon container
bg-eleva-primary/10    // Light Teal background
rounded-lg             // Rounded corners

// Icon itself
text-eleva-primary     // Deep Teal (#006D77)
```

---

### Reference Cards

```
┌──────────────────────────────────────────────┐
│  (1)  Virtual prenatal care and...          │
│       Fernandez MA, et al. (2018)           │
│       [🔗 doi.org/10.1097/AOG...]          │
└──────────────────────────────────────────────┘
    ↑                      ↑
    Teal badge            Teal link button
```

#### Number Badge:
```tsx
// Gradient circle
bg-linear-to-br 
  from-eleva-primary       // Deep Teal
  to-eleva-primary-light   // Sage Green

// Text
text-white                 // White number
font-bold                  // Bold weight
```

**Result**: Beautiful Teal → Sage Green gradient circle 🎯

#### DOI Link Button:
```tsx
// Default state
bg-eleva-primary/5         // Very light Teal
text-eleva-primary         // Deep Teal text
rounded-full               // Pill shape

// Hover state
hover:bg-eleva-primary     // Solid Deep Teal
hover:text-white           // White text
```

**Result**: Subtle Teal → Solid Teal on hover 🔗

---

### Citation Note (Bottom Card)

```
┌────────────────────────────────────────────────┐
│ 📚 How to cite:                                │
│ All studies are peer-reviewed and published in │
│ leading medical journals. Click any DOI link   │
│ to access the full publication.                │
└────────────────────────────────────────────────┘
```

```tsx
// Background
bg-eleva-secondary-light/30   // Warm Sand (30% opacity)

// Border
border-eleva-secondary/20     // Soft Coral (20% opacity)

// Accent text
text-eleva-secondary          // Soft Coral (#E29578)
```

**Result**: Warm, inviting note in Coral tones 📝

---

## 🔄 Interactive States

### Card Hover
```tsx
// Default
border-eleva-neutral-200/50
shadow-none

// Hover
hover:border-eleva-primary/30   // Teal glow
hover:shadow-md                 // Lift up
transition-all                  // Smooth
```

**Result**: Cards gently lift and glow Teal on hover ✨

---

## 📱 Mobile Experience

```
┌──────────────────────┐
│ 📚 References   [▼] │
│ 12 studies          │
├──────────────────────┤
│                     │
│ ┌─────────────────┐ │
│ │ (1) Paper...    │ │
│ │ Authors (2018)  │ │
│ │ [🔗 DOI]       │ │
│ └─────────────────┘ │
│                     │
│ (more cards...)     │
│                     │
│ ┌─────────────────┐ │
│ │ 📚 How to cite │ │
│ └─────────────────┘ │
└──────────────────────┘
```

**Features**:
- Stacks beautifully on mobile
- Large tap targets
- Easy to collapse/expand
- Smooth animations

---

## 🎯 User Benefits

### For Researchers:
✅ All references in one place  
✅ Easy to cite (DOI links)  
✅ Can collapse when not needed  
✅ Professional academic format  

### For General Users:
✅ Not overwhelming (collapsible)  
✅ Still accessible (open by default)  
✅ Beautiful visual design  
✅ Hover tooltips for quick preview in text  

### For Mobile Users:
✅ Touch-friendly  
✅ Doesn't take up entire screen  
✅ Quick access to DOI links  
✅ Smooth animations  

---

## 💡 Design Rationale

### Why Collapsible?
1. **Reduces visual clutter** - References can be long
2. **Improves scan-ability** - Main content easier to read
3. **User choice** - Can expand when needed
4. **Professional** - Mimics academic papers with endnotes

### Why Open by Default?
1. **Transparency** - Shows research backing claims
2. **Credibility** - Immediately visible
3. **Accessibility** - No hidden content
4. **User expectation** - Most want to see sources

### Why Gradient Background?
1. **Brand identity** - Uses Eleva colors
2. **Visual distinction** - Clearly separate section
3. **Premium feel** - Elevates perceived quality
4. **Guides attention** - Draws eye without overwhelming

---

## 🔤 Typography Hierarchy

```
Header:
  📚 References          ← UPPERCASE, Mono font, Teal
  12 supporting studies  ← lowercase, smaller, grey

Cards:
  Paper Title           ← Bold, 14px, Dark
  Authors (Year)        ← Regular, 12px, Grey
  DOI Link              ← Medium, 12px, Teal

Citation Note:
  How to cite:          ← Bold, 12px, Coral
  Description           ← Regular, 12px, Grey
```

---

## 🎨 Color Psychology

| Color | Purpose | Emotion |
|-------|---------|---------|
| **Deep Teal** | Primary actions | Trust, professionalism |
| **Sage Green** | Complementary | Health, growth |
| **Soft Coral** | Accents | Warmth, care |
| **Pale Lavender** | Backgrounds | Calm, elegance |
| **Charcoal** | Text | Clarity, authority |

---

## ✅ Accessibility

- ✅ **ARIA labels** on all DOI links
- ✅ **Keyboard navigation** (Tab through links)
- ✅ **High contrast** (WCAG AA compliant)
- ✅ **Clear focus states** (visible outlines)
- ✅ **Semantic HTML** (`<ol>`, `<li>`, `<sup>`)
- ✅ **Screen reader friendly** (descriptive labels)

---

## 🚀 Performance

- ✅ **Lazy rendering** (collapsed by default option)
- ✅ **Smooth animations** (CSS transitions)
- ✅ **No layout shift** (fixed heights)
- ✅ **Optimized gradients** (CSS only, no images)

---

## 💻 Code Structure

```tsx
<Accordion defaultValue="references">
  <AccordionItem className="gradient-background">
    <AccordionTrigger>
      <Icon /> References
      {count} supporting studies
    </AccordionTrigger>
    
    <AccordionContent>
      <ol>
        {papers.map(paper => (
          <ReferenceCard paper={paper} />
        ))}
      </ol>
      
      <CitationNote />
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

---

**Beautiful, functional, on-brand! ✨**

