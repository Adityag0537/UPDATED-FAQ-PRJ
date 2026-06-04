const Question = require("../models/Question");
const Answer = require("../models/Answer");
const { attachVoteStatus, attachVoteStatusList } = require("../utils/voteHelpers");
const { enrichQuestions } = require("../utils/questionEnrichment");
const { getBadgeLevel } = require("../utils/badges");

const visibleAnswerFilter = { isRemoved: { $ne: true } };

const getMyActivitySummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const [
      questionStats,
      answerStats,
      acceptedAnswersCount,
    ] = await Promise.all([
      Question.aggregate([
        { $match: { author: userId } },
        {
          $group: {
            _id: null,
            questionsCount: { $sum: 1 },
            questionUpvotesReceived: { $sum: "$upvotes" },
            questionViews: { $sum: "$views" },
          },
        },
      ]),
      Answer.aggregate([
        { $match: { author: userId, ...visibleAnswerFilter } },
        {
          $group: {
            _id: null,
            answersCount: { $sum: 1 },
            answerUpvotesReceived: { $sum: "$upvotes" },
          },
        },
      ]),
      Question.aggregate([
        { $match: { acceptedAnswer: { $ne: null } } },
        {
          $lookup: {
            from: "answers",
            localField: "acceptedAnswer",
            foreignField: "_id",
            as: "acceptedDoc",
          },
        },
        { $unwind: "$acceptedDoc" },
        {
          $match: {
            "acceptedDoc.author": userId,
            "acceptedDoc.isRemoved": { $ne: true },
          },
        },
        { $count: "count" },
      ]),
    ]);

    const questions = questionStats[0] || {};
    const answers = answerStats[0] || {};
    const spPoints = req.user.spPoints || 0;

    res.status(200).json({
      success: true,
      data: {
        spPoints,
        badge: getBadgeLevel(spPoints),
        questionsCount: questions.questionsCount || 0,
        answersCount: answers.answersCount || 0,
        acceptedAnswersCount: acceptedAnswersCount[0]?.count || 0,
        answerUpvotesReceived: answers.answerUpvotesReceived || 0,
        questionUpvotesReceived: questions.questionUpvotesReceived || 0,
        questionViews: questions.questionViews || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyQuestions = async (req, res) => {
  try {
    const questions = await Question.find({ author: req.user._id })
      .populate("author", "name email")
      .populate({
        path: "acceptedAnswer",
        match: visibleAnswerFilter,
        populate: { path: "author", select: "name email" },
      })
      .sort({ createdAt: -1 });

    const data = await enrichQuestions(questions, req.user._id);

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyAnswers = async (req, res) => {
  try {
    const answers = await Answer.find({
      author: req.user._id,
      ...visibleAnswerFilter,
    })
      .populate("author", "name email")
      .populate({
        path: "questionId",
        populate: {
          path: "acceptedAnswer",
          select: "_id content",
          match: visibleAnswerFilter,
        },
      })
      .sort({ createdAt: -1 });

    const data = attachVoteStatusList(answers, req.user._id).map((answer) => {
      const question = answer.questionId;
      const acceptedId =
        question?.acceptedAnswer?._id?.toString() ||
        question?.acceptedAnswer?.toString() ||
        null;

      return {
        ...answer,
        questionId: question?._id || answer.questionId,
        questionTitle: question?.title || "Deleted question",
        questionAcceptedAnswer: question?.acceptedAnswer || null,
        isAccepted: acceptedId === answer._id.toString(),
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getMyActivitySummary,
  getMyQuestions,
  getMyAnswers,
};
