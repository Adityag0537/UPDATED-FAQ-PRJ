import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { getQuestionStatus } from "../utils/questionStatus";

function MyActivityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("questions");
  const [myQuestions, setMyQuestions] = useState([]);
  const [myAnswers, setMyAnswers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [faqConfig, setFaqConfig] = useState({
    faqMinViews: 100,
    faqMinAgeDays: 7,
  });

  useEffect(() => {
    API.get("/config")
      .then((res) =>
        setFaqConfig({
          faqMinViews: res.data.data.faqMinViews ?? 100,
          faqMinAgeDays: res.data.data.faqMinAgeDays ?? 7,
        })
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    API.get("/users/me/activity-summary")
      .then((res) => {
        if (!cancelled) {
          setSummary(res.data.data);
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const request =
      activeTab === "questions"
        ? API.get("/users/me/questions")
        : API.get("/users/me/answers");

    request
      .then((res) => {
        if (cancelled) {
          return;
        }

        if (activeTab === "questions") {
          setMyQuestions(res.data.data);
        } else {
          setMyAnswers(res.data.data);
        }
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const loadSummary = async () => {
    try {
      const res = await API.get("/users/me/activity-summary");
      setSummary(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadActivity = async () => {
    setLoading(true);

    try {
      if (activeTab === "questions") {
        const res = await API.get("/users/me/questions");
        setMyQuestions(res.data.data);
      } else {
        const res = await API.get("/users/me/answers");
        setMyAnswers(res.data.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestion = async (questionId) => {
    if (!window.confirm("Delete this question?")) {
      return;
    }

    await API.delete(`/questions/${questionId}`);
    await Promise.all([loadActivity(), loadSummary()]);
  };

  const deleteAnswer = async (answerId) => {
    if (!window.confirm("Delete this answer?")) {
      return;
    }

    await API.delete(`/answers/${answerId}`);
    await Promise.all([loadActivity(), loadSummary()]);
  };

  const stats = summary || {
    spPoints: user?.spPoints ?? 0,
    badge: user?.badge || "Beginner",
    questionsCount: myQuestions.length,
    answersCount: myAnswers.length,
    acceptedAnswersCount: 0,
    answerUpvotesReceived: 0,
    questionUpvotesReceived: 0,
    questionViews: 0,
  };

  const formatStat = (value) => Number(value || 0).toLocaleString();

  return (
    <div className="container page activity-page">
      <header className="activity-header">
        <div>
          <span className="eyebrow">Profile</span>
          <h1>My Activity</h1>
          <p className="field-hint">
            {user?.name} · manage your questions and answers
          </p>
        </div>
        <Link to="/ask" className="btn btn-primary btn-sm">
          Ask Question
        </Link>
      </header>

      <section className="activity-summary" aria-label="Activity statistics">
        <div className="activity-stat activity-stat-primary">
          <span className="activity-stat-label">SP Points</span>
          <strong>{formatStat(stats.spPoints)}</strong>
          <span className="activity-stat-note">{stats.badge}</span>
        </div>
        <div className="activity-stat">
          <span className="activity-stat-label">Questions</span>
          <strong>{formatStat(stats.questionsCount)}</strong>
          <span className="activity-stat-note">
            {formatStat(stats.questionViews)} views
          </span>
        </div>
        <div className="activity-stat">
          <span className="activity-stat-label">Answers</span>
          <strong>{formatStat(stats.answersCount)}</strong>
          <span className="activity-stat-note">
            {formatStat(stats.acceptedAnswersCount)} accepted
          </span>
        </div>
        <div className="activity-stat">
          <span className="activity-stat-label">Upvotes</span>
          <strong>
            {formatStat(
              stats.answerUpvotesReceived + stats.questionUpvotesReceived
            )}
          </strong>
          <span className="activity-stat-note">
            {formatStat(stats.answerUpvotesReceived)} on answers
          </span>
        </div>
      </section>

      <div className="activity-tabs">
        <button
          type="button"
          className={`activity-tab ${activeTab === "questions" ? "active" : ""}`}
          onClick={() => {
            setLoading(true);
            setActiveTab("questions");
          }}
        >
          My Questions
        </button>
        <button
          type="button"
          className={`activity-tab ${activeTab === "answers" ? "active" : ""}`}
          onClick={() => {
            setLoading(true);
            setActiveTab("answers");
          }}
        >
          My Answers
        </button>
      </div>

      {loading ? (
        <LoadingState message="Loading your activity..." />
      ) : activeTab === "questions" ? (
        myQuestions.length === 0 ? (
          <EmptyState
            title="No questions yet"
            description="Questions you ask will appear here."
          />
        ) : (
          <div className="activity-list">
            {myQuestions.map((question) => {
              const status = getQuestionStatus(question, faqConfig);

              return (
                <article key={question._id} className="card activity-card">
                  <div className="activity-card-top">
                    <StatusBadge status={status} />
                    <span className="question-row-time">
                      Asked {formatRelativeTime(question.createdAt)}
                    </span>
                  </div>

                  <h3>{question.title}</h3>
                  <p className="card-body">{question.description}</p>

                  <div className="activity-meta">
                    <span className="stat-pill">👍 {question.upvotes}</span>
                    <span className="stat-pill">
                      💬 {question.answerCount ?? 0}{" "}
                      {(question.answerCount ?? 0) === 1 ? "Answer" : "Answers"}
                    </span>
                  </div>

                  {question.acceptedAnswer && (
                    <div className="accepted-preview">
                      <span className="accepted-preview-label">
                        ✓ Accepted answer available
                      </span>
                    </div>
                  )}

                  <div className="action-row">
                    <Link
                      to={`/questions/${question._id}`}
                      className="btn btn-primary btn-sm"
                    >
                      View Question
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        navigate(`/questions/${question._id}`, {
                          state: { editQuestion: true },
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteQuestion(question._id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : myAnswers.length === 0 ? (
        <EmptyState
          title="No answers yet"
          description="Answers you post will appear here."
        />
      ) : (
        <div className="activity-list">
          {myAnswers.map((answer) => (
            <article key={answer._id} className="card activity-card">
              <div className="activity-card-top">
                {answer.isAccepted ? (
                  <span className="badge badge-success">Accepted ✅</span>
                ) : (
                  <span className="badge badge-primary">Answer</span>
                )}
                <span className="question-row-time">
                  {formatRelativeTime(answer.createdAt)}
                </span>
              </div>

              <p className="activity-label">Question</p>
              <h3>{answer.questionTitle}</h3>

              <p className="activity-label">Your Answer</p>
              <p className="card-body">{answer.content}</p>

              <div className="activity-meta">
                <span className="stat-pill">👍 {answer.upvotes} Upvotes</span>
              </div>

              <div className="action-row">
                <Link
                  to={`/questions/${answer.questionId}`}
                  className="btn btn-primary btn-sm"
                >
                  View Question
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    navigate(`/questions/${answer.questionId}`, {
                      state: { editAnswerId: answer._id },
                    })
                  }
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteAnswer(answer._id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyActivityPage;
