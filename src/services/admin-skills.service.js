const { randomUUID } = require('crypto');

const SkillCategory = require('../models/SkillCategory');
const SkillDefinition = require('../models/SkillDefinition');
const ApiError = require('../utils/ApiError');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Categories ───────────────────────────────────────────────────────────────

const listCategories = async (query = {}) => {
  const filter = {};

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  return SkillCategory.find(filter).sort({ categoryName: 1 }).lean();
};

const createCategory = async (payload) => {
  const existing = await SkillCategory.findOne({
    categoryName: new RegExp(`^${escapeRegex(payload.categoryName)}$`, 'i'),
  });

  if (existing) {
    throw new ApiError(409, 'A category with this name already exists', 'CATEGORY_NAME_CONFLICT');
  }

  const category = await SkillCategory.create({
    categoryId: `CAT-${randomUUID()}`,
    categoryName: payload.categoryName,
    description: payload.description || '',
    parentCategoryId: payload.parentCategoryId || undefined,
    iconUrl: payload.iconUrl || '',
    isActive: true,
  });

  return category.toObject ? category.toObject() : { ...category };
};

const updateCategory = async (categoryId, payload) => {
  const category = await SkillCategory.findOne({ categoryId });

  if (!category) {
    throw new ApiError(404, 'Category not found', 'CATEGORY_NOT_FOUND');
  }

  if (payload.categoryName !== undefined) category.categoryName = payload.categoryName;
  if (payload.description !== undefined) category.description = payload.description;
  if (payload.parentCategoryId !== undefined) category.parentCategoryId = payload.parentCategoryId;
  if (payload.iconUrl !== undefined) category.iconUrl = payload.iconUrl;
  if (payload.isActive !== undefined) category.isActive = payload.isActive;

  await category.save();

  return category.toObject ? category.toObject() : { ...category };
};

const deleteCategory = async (categoryId) => {
  const category = await SkillCategory.findOne({ categoryId });

  if (!category) {
    throw new ApiError(404, 'Category not found', 'CATEGORY_NOT_FOUND');
  }

  category.isActive = false;
  await category.save();

  return category.toObject ? category.toObject() : { ...category };
};

// ─── Skill definitions ────────────────────────────────────────────────────────

const listSkillDefinitions = async (query = {}) => {
  const filter = {};

  if (query.categoryId?.trim()) {
    filter.categoryId = query.categoryId.trim();
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  return SkillDefinition.find(filter).sort({ skillName: 1 }).lean();
};

const createSkillDefinition = async (payload) => {
  const category = await SkillCategory.findOne({
    categoryId: payload.categoryId,
    isActive: true,
  });

  if (!category) {
    throw new ApiError(404, 'Category not found or inactive', 'CATEGORY_NOT_FOUND');
  }

  const existing = await SkillDefinition.findOne({
    skillName: new RegExp(`^${escapeRegex(payload.skillName)}$`, 'i'),
    categoryId: payload.categoryId,
  });

  if (existing) {
    throw new ApiError(
      409,
      'A skill with this name already exists in this category',
      'SKILL_NAME_CONFLICT'
    );
  }

  const def = await SkillDefinition.create({
    skillDefinitionId: `SKDEF-${randomUUID()}`,
    skillName: payload.skillName,
    categoryId: payload.categoryId,
    description: payload.description || '',
    isActive: true,
  });

  return def.toObject ? def.toObject() : { ...def };
};

const updateSkillDefinition = async (skillDefinitionId, payload) => {
  const def = await SkillDefinition.findOne({ skillDefinitionId });

  if (!def) {
    throw new ApiError(404, 'Skill definition not found', 'SKILL_DEFINITION_NOT_FOUND');
  }

  if (payload.skillName !== undefined) def.skillName = payload.skillName;
  if (payload.categoryId !== undefined) def.categoryId = payload.categoryId;
  if (payload.description !== undefined) def.description = payload.description;
  if (payload.isActive !== undefined) def.isActive = payload.isActive;

  await def.save();

  return def.toObject ? def.toObject() : { ...def };
};

const deleteSkillDefinition = async (skillDefinitionId) => {
  const def = await SkillDefinition.findOne({ skillDefinitionId });

  if (!def) {
    throw new ApiError(404, 'Skill definition not found', 'SKILL_DEFINITION_NOT_FOUND');
  }

  def.isActive = false;
  await def.save();

  return def.toObject ? def.toObject() : { ...def };
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listSkillDefinitions,
  createSkillDefinition,
  updateSkillDefinition,
  deleteSkillDefinition,
};
