const { randomUUID } = require('crypto');

const SkillCategory = require('../models/SkillCategory');

const DEFAULT_CATEGORY_NAME = 'General';

const ensureDefaultSkillCategory = async () => {
  let category = await SkillCategory.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();

  if (category) {
    return category;
  }

  category = await SkillCategory.findOne({
    categoryName: new RegExp(`^${DEFAULT_CATEGORY_NAME}$`, 'i'),
  }).lean();

  if (category) {
    if (!category.isActive) {
      await SkillCategory.updateOne(
        { categoryId: category.categoryId },
        { $set: { isActive: true } }
      );
      category.isActive = true;
    }

    return category;
  }

  const anyCategory = await SkillCategory.findOne().sort({ createdAt: 1 }).lean();

  if (anyCategory) {
    if (!anyCategory.isActive) {
      await SkillCategory.updateOne(
        { categoryId: anyCategory.categoryId },
        { $set: { isActive: true } }
      );
      anyCategory.isActive = true;
    }

    return anyCategory;
  }

  const categoryId = `CAT-${randomUUID()}`;

  return SkillCategory.create({
    categoryId,
    categoryName: DEFAULT_CATEGORY_NAME,
    parentCategoryId: '',
    description: 'Default category for learner-declared skills and validation requests.',
    iconUrl: '',
    isActive: true,
  }).then((doc) => doc.toObject());
};

module.exports = {
  ensureDefaultSkillCategory,
  DEFAULT_CATEGORY_NAME,
};
