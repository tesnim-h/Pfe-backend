const adminSkillsService = require('../services/admin-skills.service');
const ApiResponse = require('../utils/ApiResponse');

const listCategories = async (req, res, next) => {
  try {
    const categories = await adminSkillsService.listCategories(req.query);
    res.status(200).json(new ApiResponse(200, categories, 'Categories fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const category = await adminSkillsService.createCategory(req.body);
    res.status(201).json(new ApiResponse(201, category, 'Category created successfully'));
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await adminSkillsService.updateCategory(req.params.id, req.body);
    res.status(200).json(new ApiResponse(200, category, 'Category updated successfully'));
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const category = await adminSkillsService.deleteCategory(req.params.id);
    res.status(200).json(new ApiResponse(200, category, 'Category deactivated successfully'));
  } catch (error) {
    next(error);
  }
};

const listSkillDefinitions = async (req, res, next) => {
  try {
    const defs = await adminSkillsService.listSkillDefinitions(req.query);
    res.status(200).json(new ApiResponse(200, defs, 'Skill definitions fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const createSkillDefinition = async (req, res, next) => {
  try {
    const def = await adminSkillsService.createSkillDefinition(req.body);
    res.status(201).json(new ApiResponse(201, def, 'Skill definition created successfully'));
  } catch (error) {
    next(error);
  }
};

const updateSkillDefinition = async (req, res, next) => {
  try {
    const def = await adminSkillsService.updateSkillDefinition(req.params.id, req.body);
    res.status(200).json(new ApiResponse(200, def, 'Skill definition updated successfully'));
  } catch (error) {
    next(error);
  }
};

const deleteSkillDefinition = async (req, res, next) => {
  try {
    const def = await adminSkillsService.deleteSkillDefinition(req.params.id);
    res.status(200).json(new ApiResponse(200, def, 'Skill definition deactivated successfully'));
  } catch (error) {
    next(error);
  }
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
