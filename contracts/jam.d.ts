export declare const jamQuestionTopic: (slug: any) => string;
export declare const JAM_SECTIONS: {
    slug: string;
    title: string;
    symbol: string;
    color: string;
    topics: string[];
}[];
export declare const JAM_MOCK_CONFIGS: {
    'iit-jam-physics': {
        key: string;
        name: string;
        compositeTimer: boolean;
        totalDurationMin: number;
        requireFixedPaper: boolean;
        sections: {
            key: any;
            label: any;
            questionCount: any;
            timeLimitMin: number;
            marking: {
                correct: any;
                incorrect: any;
            };
            questionType: any;
            topics: string[];
        }[];
    };
};
